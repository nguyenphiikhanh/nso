<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { NsoPart, NsoPartImage } from '../types/nso'
import type { CharacterCategory } from '../types/character'
import { fetchAllParts, fetchAllImages, savePartDraft } from '../services/nso.api'
import { useCharacterActions } from '../composables/useCharacterActions'

import CharacterLibrary from './character/CharacterLibrary.vue'
import CharacterStage from './character/CharacterStage.vue'
import CharacterTimeline from './character/CharacterTimeline.vue'
import CharacterInspector from './character/CharacterInspector.vue'
import CharacterUnityExportModal from './CharacterUnityExportModal.vue'
import SpriteSheetImportModal from './character/SpriteSheetImportModal.vue'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

const showUnityExportModal = ref(false)
const showSpriteSheetModal = ref(false)

const allParts = ref<NsoPart[]>([])
const allImages = ref<Array<{ id: number; smallImage: number[] }>>([])
const loading = ref(false)
const saving = ref(false)
const toastMessage = ref<string | null>(null)

// Mode: 'align' (Chỉnh sửa khớp nối) vs 'animate' (Xem hoạt ảnh)
const studioMode = ref<'align' | 'animate'>('align')

// Category currently active for editing / nudging
const activeEditCategory = ref<CharacterCategory>('body')

// Selected Loadout for Avatar Composition
const selectedHeadId = ref<number>(2)
const selectedBodyId = ref<number>(1)
const selectedLegId = ref<number>(0)
const selectedWeaponId = ref<number>(12)
const selectedMaskId = ref<number | null>(null)
const weaponLayerOrder = ref<'behind' | 'front'>('front')
const showWeapon = ref(true)
const showGroundShadow = ref(true)
const showGuides = ref(true)
const flipHorizontal = ref(false)

// Canvas Zoom & Coordinate Base
const zoom = ref<number>(1.5)
const groundY = 250
const stageCenterX = 130
const waistOverlap = ref<number>(8)
const neckOverlap = ref<number>(20)
const nudgeStep = ref<number>(1)

// Frame selected for editing in Align mode (per category)
const selectedHeadFrameIdx = ref<number>(0)
const selectedBodyFrameIdx = ref<number>(1)
const selectedLegFrameIdx = ref<number>(1)
const selectedWeaponFrameIdx = ref<number>(1)

// Sprite image dimensions cache
const spriteDimensions = ref<Record<number, { w: number; h: number }>>({})

// Active Parts in Loadout
const activeHead = computed(() => allParts.value.find((p) => p.id === selectedHeadId.value))
const activeBody = computed(() => allParts.value.find((p) => p.id === selectedBodyId.value))
const activeLeg = computed(() => allParts.value.find((p) => p.id === selectedLegId.value))
const activeWeapon = computed(() => allParts.value.find((p) => p.id === selectedWeaponId.value))
const activeMask = computed(() =>
  selectedMaskId.value !== null ? allParts.value.find((p) => p.id === selectedMaskId.value) : null
)

// Part currently being inspected/edited
const editingPart = computed<NsoPart | undefined>(() => {
  switch (activeEditCategory.value) {
    case 'head':
      return activeHead.value
    case 'body':
      return activeBody.value
    case 'leg':
      return activeLeg.value
    case 'weapon':
      return activeWeapon.value
  }
})

// Current Frame Index being edited for the active category
const activeCategoryFrameIdx = computed<number>({
  get() {
    switch (activeEditCategory.value) {
      case 'head':
        return selectedHeadFrameIdx.value
      case 'body':
        return selectedBodyFrameIdx.value
      case 'leg':
        return selectedLegFrameIdx.value
      case 'weapon':
        return selectedWeaponFrameIdx.value
    }
  },
  set(val: number) {
    switch (activeEditCategory.value) {
      case 'head':
        selectedHeadFrameIdx.value = val
        break
      case 'body':
        selectedBodyFrameIdx.value = val
        break
      case 'leg':
        selectedLegFrameIdx.value = val
        break
      case 'weapon':
        selectedWeaponFrameIdx.value = val
        break
    }
  },
})

// Current Frame Object being edited
const activeCategoryFrame = computed<NsoPartImage | null>(() => {
  if (!editingPart.value || !editingPart.value.part) return null
  return editingPart.value.part[activeCategoryFrameIdx.value] || null
})

// Toast notification helper
function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = null
    }
  }, 3000)
}

// Initialize Animation Actions Composable
const {
  currentAction,
  currentStep,
  isPlaying,
  fps,
  actionDefinitions,
  currentActionDef,
  currentStepCount,
  activeStepIndex,
  currentStepData,
  actionSequences,
  selectAction,
  setStep,
  firstStep,
  lastStep,
  prevStep,
  nextStep,
  addActionStep,
  duplicateActionStep,
  deleteActionStep,
  reorderActionStep,
  resetCurrentAction,
  resetAllActions,
  changeStepPartFrame,
  setStepWeaponAngle,
  resetStepWeaponOffset,
  nudgeStepJoint,
  resetStepJoint,
  nudgeStepPart,
  resetStepPartOffset,
  setStepPartZIndex,
  nudgeStepPartZIndex,
  resetStepPartZIndex,
  getStepOffsetForCategory,
  startAnimationTimer,
  stopAnimationTimer,
  togglePlay,
  pauseAnimation,
} = useCharacterActions(showToast)

function handleStepPartFrame(cat: CharacterCategory, delta: number) {
  changeStepPartFrame(cat, delta, {
    head: activeHead.value,
    body: activeBody.value,
    leg: activeLeg.value,
    weapon: activeWeapon.value,
  })
}

function handleNudgeStepJoint(joint: 'neck' | 'waist', delta: number) {
  nudgeStepJoint(joint, delta, neckOverlap.value, waistOverlap.value)
}

function handleResetStepJoint(joint: 'neck' | 'waist') {
  resetStepJoint(joint, neckOverlap.value, waistOverlap.value)
}

// Fallback resolver for safe frames
function getSafePartFrame(part: NsoPart | undefined, frameIndex: number): NsoPartImage | null {
  if (!part || !part.part || part.part.length === 0) return null
  const len = part.part.length
  const cand = part.part[frameIndex % len]
  if (cand && cand.id > 0) return cand
  const fallback = part.part.find((f) => f.id > 0)
  return fallback || cand || null
}

// Active Display Frames on Canvas
const canvasLegFrame = computed<NsoPartImage | null>(() => {
  if (studioMode.value === 'align') {
    return getSafePartFrame(activeLeg.value, selectedLegFrameIdx.value)
  }
  const fIdx = currentStepData.value?.legFrame ?? 1
  return getSafePartFrame(activeLeg.value, fIdx)
})

const canvasBodyFrame = computed<NsoPartImage | null>(() => {
  if (studioMode.value === 'align') {
    return getSafePartFrame(activeBody.value, selectedBodyFrameIdx.value)
  }
  const fIdx = currentStepData.value?.bodyFrame ?? 1
  return getSafePartFrame(activeBody.value, fIdx)
})

const canvasHeadFrame = computed<NsoPartImage | null>(() => {
  if (studioMode.value === 'align') {
    return getSafePartFrame(activeHead.value, selectedHeadFrameIdx.value)
  }
  const fIdx = currentStepData.value?.headFrame ?? 0
  return getSafePartFrame(activeHead.value, fIdx)
})

const canvasWeaponFrame = computed<NsoPartImage | null>(() => {
  if (!showWeapon.value || !activeWeapon.value) return null
  if (studioMode.value === 'align') {
    return getSafePartFrame(activeWeapon.value, selectedWeaponFrameIdx.value)
  }
  const fIdx = currentStepData.value?.weaponFrame ?? 1
  return getSafePartFrame(activeWeapon.value, fIdx)
})

const canvasMaskFrame = computed<NsoPartImage | null>(() => {
  if (!activeMask.value) return null
  if (studioMode.value === 'align') {
    return getSafePartFrame(activeMask.value, selectedHeadFrameIdx.value)
  }
  const fIdx = currentStepData.value?.headFrame ?? 0
  return getSafePartFrame(activeMask.value, fIdx)
})

const breathOffset = computed<number>(() => {
  if (studioMode.value === 'align') return 0
  return currentStepData.value?.breathBob ?? 0
})

const lungeOffset = computed<number>(() => {
  if (studioMode.value === 'align') return 0
  return currentStepData.value?.lungeX ?? 0
})

const jumpOffset = computed<number>(() => {
  if (studioMode.value === 'align') return 0
  return currentStepData.value?.jumpY ?? 0
})

const weaponAnimOffset = computed<{ dx: number; dy: number; rot: number }>(() => {
  if (studioMode.value === 'align') return { dx: 0, dy: 0, rot: 0 }
  return currentStepData.value?.weaponOffset ?? { dx: 0, dy: 0, rot: 0 }
})

const groundShadowScale = computed<number>(() => {
  if (studioMode.value === 'align') return 1
  return currentStepData.value?.shadowScale ?? 1
})

const groundShadowOpacity = computed<number>(() => {
  if (studioMode.value === 'align') return 0.75
  return currentStepData.value?.shadowOpacity ?? 0.75
})

// Sprite dimensions helper
function getDim(id: number | undefined): { w: number; h: number } {
  if (!id || id <= 0) return { w: 60, h: 32 }
  if (spriteDimensions.value[id]) return spriteDimensions.value[id]!
  return { w: 84, h: 44 }
}

function handleImageLoaded(id: number, evt: Event) {
  const img = evt.target as HTMLImageElement
  if (img && img.naturalWidth > 0) {
    spriteDimensions.value[id] = {
      w: img.naturalWidth,
      h: img.naturalHeight,
    }
  }
}

// Effective Joint Overlaps: Base overlap + Step offset
const effectiveWaistOverlap = computed<number>(() => {
  if (studioMode.value === 'align') return waistOverlap.value
  return waistOverlap.value + (currentStepData.value?.waistOffset ?? 0)
})

const effectiveNeckOverlap = computed<number>(() => {
  if (studioMode.value === 'align') return neckOverlap.value
  return neckOverlap.value + (currentStepData.value?.neckOffset ?? 0)
})

// Step-specific offsets
const stepLegOffset = computed(() => {
  if (studioMode.value === 'align') return { dx: 0, dy: 0 }
  return currentStepData.value?.legOffset ?? { dx: 0, dy: 0 }
})

const stepBodyOffset = computed(() => {
  if (studioMode.value === 'align') return { dx: 0, dy: 0 }
  return currentStepData.value?.bodyOffset ?? { dx: 0, dy: 0 }
})

const stepHeadOffset = computed(() => {
  if (studioMode.value === 'align') return { dx: 0, dy: 0 }
  return currentStepData.value?.headOffset ?? { dx: 0, dy: 0 }
})

// 1. Leg position
const legDim = computed(() => getDim(canvasLegFrame.value?.id))
const legPos = computed(() => {
  const f = canvasLegFrame.value
  const dx = (f ? f.dx : 0) + stepLegOffset.value.dx
  const dy = (f ? f.dy : 0) + stepLegOffset.value.dy
  const top = groundY - legDim.value.h + dy + jumpOffset.value
  const left = stageCenterX - Math.floor(legDim.value.w / 2) + dx + lungeOffset.value
  return { top, left, w: legDim.value.w, h: legDim.value.h }
})

// 2. Body position
const bodyDim = computed(() => getDim(canvasBodyFrame.value?.id))
const bodyPos = computed(() => {
  const f = canvasBodyFrame.value
  const dx = (f ? f.dx : 0) + stepBodyOffset.value.dx
  const dy = (f ? f.dy : 0) + stepBodyOffset.value.dy
  const top = legPos.value.top - bodyDim.value.h + effectiveWaistOverlap.value + dy + breathOffset.value
  const left = stageCenterX - Math.floor(bodyDim.value.w / 2) + dx + lungeOffset.value
  return { top, left, w: bodyDim.value.w, h: bodyDim.value.h }
})

// 3. Head position
const headDim = computed(() => getDim(canvasHeadFrame.value?.id))
const headPos = computed(() => {
  const f = canvasHeadFrame.value
  const dx = (f ? f.dx : 0) + stepHeadOffset.value.dx
  const dy = (f ? f.dy : 0) + stepHeadOffset.value.dy
  const top = bodyPos.value.top - headDim.value.h + effectiveNeckOverlap.value + dy + breathOffset.value
  const left = stageCenterX - Math.floor(headDim.value.w / 2) + dx + lungeOffset.value
  return { top, left, w: headDim.value.w, h: headDim.value.h }
})

// 4. Weapon position
const weaponDim = computed(() => getDim(canvasWeaponFrame.value?.id))
const weaponPos = computed(() => {
  const f = canvasWeaponFrame.value
  const dx = f ? f.dx : 0
  const dy = f ? f.dy : 0
  const top = bodyPos.value.top + 8 + dy + weaponAnimOffset.value.dy
  const left = stageCenterX + 4 + dx + lungeOffset.value + weaponAnimOffset.value.dx
  return { top, left, w: weaponDim.value.w, h: weaponDim.value.h }
})

// Active part offset on D-Pad in Animate mode
const activePartStepOffset = computed(() => {
  return getStepOffsetForCategory(activeEditCategory.value)
})

// Nudge controllers
function nudge(deltaX: number, deltaY: number) {
  if (!activeCategoryFrame.value) return
  const mult = nudgeStep.value
  activeCategoryFrame.value.dx += deltaX * mult
  activeCategoryFrame.value.dy += deltaY * mult
  showToast(`[${activeEditCategory.value.toUpperCase()}] dx: ${activeCategoryFrame.value.dx}, dy: ${activeCategoryFrame.value.dy}`)
}

function resetOffset() {
  if (!activeCategoryFrame.value) return
  activeCategoryFrame.value.dx = 0
  activeCategoryFrame.value.dy = 0
  showToast('Đã đặt lại (0, 0)')
}

function nudgeActive(deltaX: number, deltaY: number) {
  if (studioMode.value === 'align') {
    nudge(deltaX, deltaY)
  } else if (studioMode.value === 'animate') {
    nudgeStepPart(activeEditCategory.value, deltaX, deltaY)
  }
}

// Dragging directly on stage
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ dx: 0, dy: 0 })

function startDrag(e: MouseEvent) {
  if (studioMode.value === 'align') {
    if (!activeCategoryFrame.value) return
    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
    initialOffset.value = {
      dx: activeCategoryFrame.value.dx,
      dy: activeCategoryFrame.value.dy,
    }
  } else if (studioMode.value === 'animate') {
    if (!currentStepData.value) return
    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
    const current = getStepOffsetForCategory(activeEditCategory.value)
    initialOffset.value = { dx: current.dx, dy: current.dy }
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  const dxPix = Math.round((e.clientX - dragStart.value.x) / zoom.value)
  const dyPix = Math.round((e.clientY - dragStart.value.y) / zoom.value)
  if (studioMode.value === 'align') {
    if (!activeCategoryFrame.value) return
    activeCategoryFrame.value.dx = initialOffset.value.dx + dxPix
    activeCategoryFrame.value.dy = initialOffset.value.dy + dyPix
  } else if (studioMode.value === 'animate' && currentStepData.value) {
    const targetDx = initialOffset.value.dx + dxPix
    const targetDy = initialOffset.value.dy + dyPix
    const cat = activeEditCategory.value
    if (cat === 'head' && currentStepData.value.headOffset) {
      currentStepData.value.headOffset.dx = targetDx
      currentStepData.value.headOffset.dy = targetDy
    } else if (cat === 'body' && currentStepData.value.bodyOffset) {
      currentStepData.value.bodyOffset.dx = targetDx
      currentStepData.value.bodyOffset.dy = targetDy
    } else if (cat === 'leg' && currentStepData.value.legOffset) {
      currentStepData.value.legOffset.dx = targetDx
      currentStepData.value.legOffset.dy = targetDy
    } else if (cat === 'weapon') {
      currentStepData.value.weaponOffset.dx = targetDx
      currentStepData.value.weaponOffset.dy = targetDy
    }
  }
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

// Global Keyboard Handler
function handleKeyDown(e: KeyboardEvent) {
  const activeTag = (document.activeElement?.tagName || '').toLowerCase()
  if (activeTag === 'input' || activeTag === 'textarea') return

  if (studioMode.value === 'animate') {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nudgeActive(0, -1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nudgeActive(0, 1)
    } else if (e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      nudgeActive(-1, 0)
    } else if (e.shiftKey && e.key === 'ArrowRight') {
      e.preventDefault()
      nudgeActive(1, 0)
    } else if ((e.ctrlKey || e.altKey) && e.key === 'ArrowLeft') {
      e.preventDefault()
      if (activeStepIndex.value > 0) {
        reorderActionStep(activeStepIndex.value, activeStepIndex.value - 1)
      }
    } else if ((e.ctrlKey || e.altKey) && e.key === 'ArrowRight') {
      e.preventDefault()
      if (activeStepIndex.value < currentStepCount.value - 1) {
        reorderActionStep(activeStepIndex.value, activeStepIndex.value + 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prevStep()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextStep()
    } else if (e.key === 'Home') {
      e.preventDefault()
      firstStep()
    } else if (e.key === 'End') {
      e.preventDefault()
      lastStep()
    }
    return
  }

  if (studioMode.value !== 'align') return

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    nudge(0, -1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    nudge(0, 1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    nudge(-1, 0)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    nudge(1, 0)
  }
}

// Equip & Loadout Presets
function equipPart(part: NsoPart) {
  if (part.type === 0) {
    selectedHeadId.value = part.id
    activeEditCategory.value = 'head'
  } else if (part.type === 1) {
    selectedBodyId.value = part.id
    activeEditCategory.value = 'body'
  } else if (part.type === 2) {
    selectedLegId.value = part.id
    activeEditCategory.value = 'leg'
  } else if (part.type === 3) {
    selectedWeaponId.value = part.id
    activeEditCategory.value = 'weapon'
  }
  showToast(`Đã trang bị Part #${part.id}`)
}

function setPresetStarter() {
  selectedHeadId.value = 2
  selectedBodyId.value = 1
  selectedLegId.value = 0
  selectedWeaponId.value = 12
  selectedMaskId.value = null
  showToast('Đã tải trang phục: Ninja Khởi Đầu')
}

function setPresetSasuke() {
  selectedHeadId.value = 112
  selectedBodyId.value = 3
  selectedLegId.value = 4
  selectedWeaponId.value = 41
  selectedMaskId.value = null
  showToast('Đã tải trang phục: Sát Thủ Sasuke')
}

function randomizeLoadout() {
  const heads = allParts.value.filter((p) => p.type === 0)
  const bodies = allParts.value.filter((p) => p.type === 1)
  const legs = allParts.value.filter((p) => p.type === 2)
  const weapons = allParts.value.filter((p) => p.type === 3)

  if (heads.length) {
    const rHead = heads[Math.floor(Math.random() * heads.length)]
    if (rHead) selectedHeadId.value = rHead.id
  }
  if (bodies.length) {
    const rBody = bodies[Math.floor(Math.random() * bodies.length)]
    if (rBody) selectedBodyId.value = rBody.id
  }
  if (legs.length) {
    const rLeg = legs[Math.floor(Math.random() * legs.length)]
    if (rLeg) selectedLegId.value = rLeg.id
  }
  if (weapons.length) {
    const rWeap = weapons[Math.floor(Math.random() * weapons.length)]
    if (rWeap) selectedWeaponId.value = rWeap.id
  }
  showToast('🎲 Đã tạo trang phục ngẫu nhiên!')
}

// Frame operations for Align Mode
function addFrame() {
  if (!editingPart.value) return
  const last = editingPart.value.part.at(-1)
  editingPart.value.part.push({
    id: last ? last.id : 0,
    dx: 0,
    dy: 0,
  })
  activeCategoryFrameIdx.value = editingPart.value.part.length - 1
  showToast('Đã thêm 1 frame mới')
}

function duplicateCurrentFrame() {
  if (!editingPart.value || !activeCategoryFrame.value) return
  const copy = { ...activeCategoryFrame.value }
  editingPart.value.part.splice(activeCategoryFrameIdx.value + 1, 0, copy)
  activeCategoryFrameIdx.value++
  showToast('Đã nhân bản frame')
}

function removeCurrentFrame() {
  if (!editingPart.value || editingPart.value.part.length <= 1) return
  editingPart.value.part.splice(activeCategoryFrameIdx.value, 1)
  if (activeCategoryFrameIdx.value >= editingPart.value.part.length) {
    activeCategoryFrameIdx.value = editingPart.value.part.length - 1
  }
  showToast('Đã xóa frame')
}

// Save Changes
async function saveEditingPart() {
  if (!editingPart.value) return
  saving.value = true
  try {
    await savePartDraft(editingPart.value.id, {
      type: editingPart.value.type,
      part: editingPart.value.part,
    })
    editingPart.value.isDraft = true
    emit('draft-updated')
    showToast(`Đã lưu Part #${editingPart.value.id} vào Changeset!`)
  } catch (err: any) {
    console.error('Lỗi lưu part:', err)
    alert(`Lỗi lưu part: ${err.message}`)
  } finally {
    saving.value = false
  }
}

// Data Loading & Refresh
async function loadPartsData() {
  loading.value = true
  try {
    const [pList, imgList] = await Promise.all([fetchAllParts(), fetchAllImages()])
    allParts.value = pList
    allImages.value = imgList
  } catch (err) {
    console.error('Lỗi tải dữ liệu avatar:', err)
  } finally {
    loading.value = false
  }
}

async function handlePartCreated(newPart: NsoPart) {
  await loadPartsData()
  equipPart(newPart)
  emit('draft-updated')
  showToast(`✨ Đã tạo và mặc thử trang phục mới #${newPart.id}!`)
}

// Lifecycle
onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  await loadPartsData()
  startAnimationTimer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  stopAnimationTimer()
})
</script>

<template>
  <div class="character-studio">
    <!-- LEFT PANEL: THƯ VIỆN & TRANG PHỤC -->
    <CharacterLibrary
      :all-parts="allParts"
      :selected-head-id="selectedHeadId"
      :selected-body-id="selectedBodyId"
      :selected-leg-id="selectedLegId"
      :selected-weapon-id="selectedWeaponId"
      @equip-part="equipPart"
      @set-starter="setPresetStarter"
      @set-sasuke="setPresetSasuke"
      @randomize="randomizeLoadout"
      @open-slicer="showSpriteSheetModal = true"
    />

    <!-- CENTER VIEWPORT: SÂN KHẤU & TIMELINE -->
    <main class="char-viewport">
      <!-- Mode Toggle & Top Toolbar -->
      <div class="viewport-toolbar">
        <!-- Chế độ: Chỉnh Khớp Nối vs Xem Hoạt Ảnh -->
        <div class="mode-switch-group">
          <button
            class="mode-btn"
            :class="{ active: studioMode === 'align' }"
            @click="studioMode = 'align'"
          >
            ✏️ Chỉnh Khớp Nối (Align)
          </button>
          <button
            class="mode-btn"
            :class="{ active: studioMode === 'animate' }"
            @click="studioMode = 'animate'"
          >
            🎬 Xem Hoạt Ảnh (Play)
          </button>
        </div>

        <!-- Animation Controls (Mode Animate) -->
        <div v-if="studioMode === 'animate'" class="anim-toolbar-group">
          <button class="btn-play-pause" @click="togglePlay">
            {{ isPlaying ? '⏸ Tạm dừng' : '▶ Tiếp tục' }}
          </button>
          <span class="fps-lbl">FPS:</span>
          <input v-model.number="fps" type="range" min="1" max="20" class="fps-slider" />
          <span class="val-mono">{{ fps }}</span>
        </div>

        <!-- Tool Toggles: Zoom, Đảo mặt, Vạch căn, Export Unity -->
        <div class="tools-group">
          <div class="zoom-selector">
            <button
              v-for="z in [1, 1.5, 2, 3]"
              :key="z"
              class="btn-zoom"
              :class="{ active: zoom === z }"
              @click="zoom = z"
            >
              {{ z }}x
            </button>
          </div>

          <button
            class="btn-toggle"
            :class="{ active: showGuides }"
            @click="showGuides = !showGuides"
            title="Bật/Tắt vạch căn chỉnh pixel"
          >
            📐 Vạch Căn
          </button>

          <button
            class="btn-toggle"
            :class="{ active: flipHorizontal }"
            @click="flipHorizontal = !flipHorizontal"
            title="Đảo mặt trái/phải"
          >
            ↔ Đảo Mặt
          </button>

          <button
            class="btn-export-unity"
            @click="showUnityExportModal = true"
            title="Xuất animation và dữ liệu cho Unity C#"
          >
            📦 Xuất Cho Unity
          </button>
        </div>
      </div>

      <!-- Action & Category Bar -->
      <div class="sub-action-bar">
        <!-- Chọn bộ phận đang chỉnh nhanh -->
        <div class="category-pill-selector">
          <span class="bar-lbl">Đang chỉnh:</span>
          <button
            class="pill-btn"
            :class="{ active: activeEditCategory === 'head' }"
            @click="activeEditCategory = 'head'"
          >
            🧢 Đầu #{{ selectedHeadId }}
          </button>
          <button
            class="pill-btn"
            :class="{ active: activeEditCategory === 'body' }"
            @click="activeEditCategory = 'body'"
          >
            🥋 Thân #{{ selectedBodyId }}
          </button>
          <button
            class="pill-btn"
            :class="{ active: activeEditCategory === 'leg' }"
            @click="activeEditCategory = 'leg'"
          >
            👖 Chân #{{ selectedLegId }}
          </button>
          <button
            class="pill-btn"
            :class="{ active: activeEditCategory === 'weapon' }"
            @click="activeEditCategory = 'weapon'"
          >
            ⚔️ Vũ Khí #{{ selectedWeaponId }}
          </button>
        </div>

        <!-- Action Selector (Đứng / Chạy / Đánh / Nhảy) -->
        <div v-if="studioMode === 'animate'" class="actions-group">
          <button
            class="action-btn"
            :class="{ active: currentAction === 'idle' }"
            @click="selectAction('idle')"
          >
            🧘 Đứng
          </button>
          <button
            class="action-btn"
            :class="{ active: currentAction === 'walk' }"
            @click="selectAction('walk')"
          >
            🏃 Chạy
          </button>
          <button
            class="action-btn"
            :class="{ active: currentAction === 'attack' }"
            @click="selectAction('attack')"
          >
            ⚔️ Đánh
          </button>
          <button
            class="action-btn"
            :class="{ active: currentAction === 'jump' }"
            @click="selectAction('jump')"
          >
            ⚡ Nhảy
          </button>
        </div>

        <!-- Overlap Sliders -->
        <div class="overlap-adjusters">
          <span class="bar-lbl">Khớp Cổ:</span>
          <template v-if="studioMode === 'align'">
            <input v-model.number="neckOverlap" type="range" min="0" max="36" class="mini-slider" />
            <span class="val-mono">{{ neckOverlap }}px</span>
          </template>
          <template v-else-if="currentStepData">
            <button class="btn-mini-step" @click="nudgeStepJoint('neck', -1)">-</button>
            <input v-model.number="currentStepData.neckOffset" type="range" min="-14" max="16" class="mini-slider" />
            <button class="btn-mini-step" @click="nudgeStepJoint('neck', 1)">+</button>
            <span class="val-mono" :title="`Gốc ${neckOverlap}px + Bù ${currentStepData.neckOffset ?? 0}px`">
              {{ effectiveNeckOverlap }}px <small class="text-joint-delta">({{ (currentStepData.neckOffset ?? 0) >= 0 ? '+' : '' }}{{ currentStepData.neckOffset ?? 0 }})</small>
            </span>
          </template>

          <span class="bar-lbl" style="margin-left: 8px;">Khớp Eo:</span>
          <template v-if="studioMode === 'align'">
            <input v-model.number="waistOverlap" type="range" min="0" max="24" class="mini-slider" />
            <span class="val-mono">{{ waistOverlap }}px</span>
          </template>
          <template v-else-if="currentStepData">
            <button class="btn-mini-step" @click="nudgeStepJoint('waist', -1)">-</button>
            <input v-model.number="currentStepData.waistOffset" type="range" min="-12" max="16" class="mini-slider" />
            <button class="btn-mini-step" @click="nudgeStepJoint('waist', 1)">+</button>
            <span class="val-mono" :title="`Gốc ${waistOverlap}px + Bù ${currentStepData.waistOffset ?? 0}px`">
              {{ effectiveWaistOverlap }}px <small class="text-joint-delta">({{ (currentStepData.waistOffset ?? 0) >= 0 ? '+' : '' }}{{ currentStepData.waistOffset ?? 0 }})</small>
            </span>
          </template>
        </div>
      </div>

      <!-- Stage Center Component -->
      <CharacterStage
        :zoom="zoom"
        :flip-horizontal="flipHorizontal"
        :show-guides="showGuides"
        :show-ground-shadow="showGroundShadow"
        :weapon-layer-order="weaponLayerOrder"
        :ground-y="groundY"
        :stage-center-x="stageCenterX"
        :effective-waist-overlap="effectiveWaistOverlap"
        :effective-neck-overlap="effectiveNeckOverlap"
        :active-edit-category="activeEditCategory"
        :canvas-leg-frame="canvasLegFrame"
        :canvas-body-frame="canvasBodyFrame"
        :canvas-head-frame="canvasHeadFrame"
        :canvas-weapon-frame="canvasWeaponFrame"
        :canvas-mask-frame="canvasMaskFrame"
        :leg-pos="legPos"
        :body-pos="bodyPos"
        :head-pos="headPos"
        :weapon-pos="weaponPos"
        :weapon-anim-offset="weaponAnimOffset"
        :lunge-offset="lungeOffset"
        :ground-shadow-scale="groundShadowScale"
        :ground-shadow-opacity="groundShadowOpacity"
        :is-dragging="isDragging"
        :current-step-data="currentStepData"
        @start-drag="startDrag"
        @select-category="activeEditCategory = $event"
        @image-loaded="handleImageLoaded"
      />

      <!-- Bottom Filmstrip / Visual Timeline Component -->
      <CharacterTimeline
        :studio-mode="studioMode"
        :editing-part="editingPart"
        :active-category-frame-idx="activeCategoryFrameIdx"
        :current-action-def="currentActionDef"
        :current-step-count="currentStepCount"
        :active-step-index="activeStepIndex"
        :is-playing="isPlaying"
        @select-frame-idx="activeCategoryFrameIdx = $event"
        @add-frame="addFrame"
        @duplicate-frame="duplicateCurrentFrame"
        @remove-frame="removeCurrentFrame"
        @set-step="setStep"
        @toggle-play="togglePlay"
        @pause="pauseAnimation"
        @first-step="firstStep"
        @prev-step="prevStep"
        @next-step="nextStep"
        @last-step="lastStep"
        @add-action-step="addActionStep"
        @duplicate-action-step="duplicateActionStep"
        @delete-action-step="deleteActionStep"
        @reset-current-action="resetCurrentAction"
        @reorder-step="(from, to) => reorderActionStep(from, to)"
      />
    </main>

    <!-- RIGHT PANEL: INSPECTOR & CONTROLS -->
    <CharacterInspector
      :studio-mode="studioMode"
      :active-edit-category="activeEditCategory"
      :nudge-step="nudgeStep"
      :current-action-def="currentActionDef"
      :current-step-count="currentStepCount"
      :active-step-index="activeStepIndex"
      :current-step-data="currentStepData"
      :effective-neck-overlap="effectiveNeckOverlap"
      :effective-waist-overlap="effectiveWaistOverlap"
      :active-part-step-offset="activePartStepOffset"
      :selected-head-id="selectedHeadId"
      :selected-body-id="selectedBodyId"
      :selected-leg-id="selectedLegId"
      :selected-weapon-id="selectedWeaponId"
      :neck-overlap="neckOverlap"
      :waist-overlap="waistOverlap"
      :editing-part="editingPart"
      :active-category-frame-idx="activeCategoryFrameIdx"
      :active-category-frame="activeCategoryFrame"
      :saving="saving"
      :sprite-dimensions="spriteDimensions"
      :equipped-parts="{
        head: activeHead,
        body: activeBody,
        leg: activeLeg,
        weapon: activeWeapon,
      }"
      @set-nudge-step="nudgeStep = $event"
      @select-category="activeEditCategory = $event"
      @change-step-part-frame="handleStepPartFrame"
      @nudge-step-joint="handleNudgeStepJoint"
      @reset-step-joint="handleResetStepJoint"
      @nudge-step-part="nudgeStepPart"
      @reset-step-part="resetStepPartOffset"
      @set-step-weapon-angle="setStepWeaponAngle"
      @reset-step-weapon-offset="resetStepWeaponOffset"
      @set-step-part-z="setStepPartZIndex"
      @nudge-step-part-z="nudgeStepPartZIndex"
      @reset-step-part-z="resetStepPartZIndex"
      @add-action-step="addActionStep"
      @duplicate-action-step="duplicateActionStep"
      @delete-action-step="deleteActionStep"
      @reset-current-action="resetCurrentAction"
      @notify="showToast"
      @save-editing-part="saveEditingPart"
      @nudge="nudge"
      @reset-offset="resetOffset"
      @select-frame-idx="activeCategoryFrameIdx = $event"
      @add-frame="addFrame"
      @duplicate-frame="duplicateCurrentFrame"
      @remove-frame="removeCurrentFrame"
    />

    <!-- Toast Notification -->
    <div v-if="toastMessage" class="toast-popup">
      {{ toastMessage }}
    </div>

    <!-- Modal Export cho Unity -->
    <CharacterUnityExportModal
      v-if="showUnityExportModal"
      :initial-action="currentAction"
      :loadout="{
        headId: selectedHeadId,
        bodyId: selectedBodyId,
        legId: selectedLegId,
        weaponId: selectedWeaponId,
        maskId: selectedMaskId,
      }"
      :parts="{
        head: activeHead,
        body: activeBody,
        leg: activeLeg,
        weapon: activeWeapon,
        mask: activeMask,
      }"
      :action-sequences="actionSequences"
      :waist-overlap="waistOverlap"
      :neck-overlap="neckOverlap"
      :fps="fps"
      :weapon-layer-order="weaponLayerOrder"
      :sprite-dimensions="spriteDimensions"
      @close="showUnityExportModal = false"
    />

    <!-- Modal Nhập Sprite Sheet & Tự Thiết Kế -->
    <SpriteSheetImportModal
      v-if="showSpriteSheetModal"
      @close="showSpriteSheetModal = false"
      @part-created="handlePartCreated"
    />
  </div>
</template>

<style scoped>
.character-studio {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #101416;
  color: #c4d0d4;
  font-family: inherit;
  font-size: 13px;
  position: relative;
}

/* CENTER VIEWPORT */
.char-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #101416;
  position: relative;
  min-width: 0;
}

/* TOP TOOLBAR */
.viewport-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #171d1f;
  border-bottom: 1px solid #344143;
  gap: 12px;
  flex-wrap: wrap;
  z-index: 10;
}

.mode-switch-group {
  display: flex;
  background: #1c2326;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid #344143;
  gap: 4px;
}

.mode-btn {
  background: transparent;
  border: none;
  color: #8fa0a5;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: #e0e6e8;
}

.mode-btn.active {
  background: #252e31;
  color: #b9f36b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.anim-toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1c2326;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #344143;
}

.btn-play-pause {
  background: #252e31;
  border: 1px solid #344143;
  color: #e0e6e8;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.btn-play-pause:hover {
  background: #344143;
  color: #b9f36b;
}

.fps-lbl {
  font-size: 11px;
  color: #8fa0a5;
}

.fps-slider {
  width: 70px;
  accent-color: #b9f36b;
  cursor: pointer;
}

.val-mono {
  font-family: monospace;
  font-size: 11px;
  color: #b9f36b;
  min-width: 18px;
}

.tools-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-selector {
  display: flex;
  background: #1c2326;
  border-radius: 4px;
  border: 1px solid #344143;
  overflow: hidden;
}

.btn-zoom {
  background: transparent;
  border: none;
  color: #8fa0a5;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}

.btn-zoom.active {
  background: #252e31;
  color: #b9f36b;
  font-weight: bold;
}

.btn-toggle {
  background: #1c2326;
  border: 1px solid #344143;
  color: #8fa0a5;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-toggle.active {
  background: #252e31;
  border-color: #b9f36b;
  color: #b9f36b;
}

.btn-export-unity {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1c2326;
  border: 1px solid #344143;
  color: #b9f36b;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-export-unity:hover {
  background: #252e31;
  border-color: #b9f36b;
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.2);
}

/* SUB ACTION BAR */
.sub-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: #171d1f;
  border-bottom: 1px solid #252e31;
  gap: 12px;
  font-size: 11px;
  flex-wrap: wrap;
  z-index: 9;
}

.category-pill-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-lbl {
  color: #8fa0a5;
  font-weight: 500;
  margin-right: 2px;
}

.pill-btn {
  background: #1c2326;
  border: 1px solid #344143;
  color: #8fa0a5;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.pill-btn:hover {
  color: #e0e6e8;
  border-color: #4a5c60;
}

.pill-btn.active {
  background: #252e31;
  border-color: #b9f36b;
  color: #b9f36b;
  font-weight: bold;
}

.actions-group {
  display: flex;
  background: #1c2326;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid #344143;
  gap: 2px;
}

.action-btn {
  background: transparent;
  border: none;
  color: #8fa0a5;
  padding: 4px 9px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  color: #e0e6e8;
}

.action-btn.active {
  background: #252e31;
  color: #b9f36b;
  font-weight: bold;
}

.overlap-adjusters {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1c2326;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #344143;
}

.mini-slider {
  width: 55px;
  accent-color: #b9f36b;
  cursor: pointer;
}

.btn-mini-step {
  background: #252e31;
  border: 1px solid #344143;
  color: #c4d0d4;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}

.btn-mini-step:hover {
  background: #344143;
  color: #b9f36b;
}

.text-joint-delta {
  color: #b9f36b;
  font-weight: bold;
  font-size: 9px;
}

/* TOAST POPUP */
.toast-popup {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #171d1f;
  color: #b9f36b;
  border: 1px solid #b9f36b;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  pointer-events: none;
  animation: fadeInOut 0.2s ease;
}

@keyframes fadeInOut {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
