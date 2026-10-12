<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { NsoPart, NsoPartImage } from '../types/nso'
import { exportCharacterUnityPackage } from '../services/nso.api'

const props = defineProps<{
  loadout: {
    headId: number
    bodyId: number
    legId: number
    weaponId: number
    maskId: number | null
  }
  parts: {
    head?: NsoPart | null
    body?: NsoPart | null
    leg?: NsoPart | null
    weapon?: NsoPart | null
    mask?: NsoPart | null
  }
  actionSequences: Record<string, any>
  waistOverlap: number
  neckOverlap: number
  fps: number
  weaponLayerOrder: 'behind' | 'front'
  spriteDimensions: Record<number, { w: number; h: number }>
  initialAction?: 'idle' | 'walk' | 'attack' | 'jump'
}>()

defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref<'modular' | 'atlas' | 'baked'>('modular')

// Chỉ xuất 1 animation trong 1 lần
const selectedAction = ref<'idle' | 'walk' | 'attack' | 'jump'>(
  props.initialAction || 'idle'
)

const actionLabels: Record<'idle' | 'walk' | 'attack' | 'jump', { label: string; icon: string }> = {
  idle: { label: 'Đứng yên (Idle)', icon: '🧘' },
  walk: { label: 'Chạy / Di chuyển (Walk)', icon: '🏃' },
  attack: { label: 'Đánh kiếm / Tấn công (Attack)', icon: '⚔️' },
  jump: { label: 'Nhảy / Bay cao (Jump)', icon: '⚡' },
}

// ==================== TAB 1: MODULAR JSON (1 ANIMATION) ====================
const fullExportJson = computed(() => {
  const partsList = [props.parts.head, props.parts.body, props.parts.leg, props.parts.weapon, props.parts.mask]
    .filter((p): p is NsoPart => !!p)
    .map((p) => ({
      id: p.id,
      type: p.type,
      typeLabel: p.type === 0 ? 'head' : p.type === 1 ? 'body' : p.type === 2 ? 'leg' : 'weapon',
      frames: p.part || [],
    }))

  const actKey = selectedAction.value
  const seq = props.actionSequences[actKey]

  return {
    meta: {
      generator: 'Game Asset Studio - NSO Single Action Unity Exporter',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      action: actKey,
      actionLabel: actionLabels[actKey].label,
      fps: props.fps,
      waistOverlap: props.waistOverlap,
      neckOverlap: props.neckOverlap,
      weaponLayerOrder: props.weaponLayerOrder,
    },
    loadout: props.loadout,
    action: {
      name: actKey,
      label: actionLabels[actKey].label,
      sequence: seq || null,
    },
    parts: partsList,
  }
})

const jsonString = computed(() => JSON.stringify(fullExportJson.value, null, 2))
const copiedToast = ref(false)

async function copyJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(jsonString.value)
    copiedToast.value = true
    setTimeout(() => {
      copiedToast.value = false
    }, 2500)
  } catch (err) {
    console.error('Lỗi copy:', err)
  }
}

function downloadJsonFile() {
  const blob = new Blob([jsonString.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `character_${selectedAction.value}_loadout_${props.loadout.headId}_${props.loadout.bodyId}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Server Package ZIP (1 Animation)
const packagingZip = ref(false)
const zipSuccessUrl = ref<string | null>(null)
const zipFilename = ref<string | null>(null)
const zipCopiedCount = ref(0)
const zipError = ref('')

async function downloadZipPackage() {
  packagingZip.value = true
  zipError.value = ''
  zipSuccessUrl.value = null

  try {
    const partsArray = [
      props.parts.head,
      props.parts.body,
      props.parts.leg,
      props.parts.weapon,
      props.parts.mask,
    ].filter((p): p is NsoPart => !!p)

    const res = await exportCharacterUnityPackage({
      loadout: props.loadout,
      actionName: selectedAction.value,
      actionSequence: props.actionSequences[selectedAction.value],
      waistOverlap: props.waistOverlap,
      neckOverlap: props.neckOverlap,
      fps: props.fps,
      parts: partsArray,
    })

    if (res.success && res.downloadUrl) {
      zipSuccessUrl.value = res.downloadUrl
      zipFilename.value = res.filename
      zipCopiedCount.value = res.copiedSprites || 0

      // Auto trigger download
      const a = document.createElement('a')
      a.href = res.downloadUrl
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch (err: any) {
    zipError.value = err.message || 'Lỗi khi đóng gói ZIP.'
  } finally {
    packagingZip.value = false
  }
}

// ==================== TAB 2: BAKED SPRITESHEET (1 ANIMATION) ====================
const bakeScale = ref<1 | 2>(1)
const bakeBackground = ref<'transparent' | 'dark'>('transparent')
const baking = ref(false)
const sheetPreviewUrl = ref<string | null>(null)
const sheetMetadataJson = ref<any | null>(null)
const sheetDimensions = ref<{ w: number; h: number; framesCount: number; frameW: number; frameH: number }>({
  w: 0,
  h: 0,
  framesCount: 0,
  frameW: 0,
  frameH: 0,
})

// Image cache loader helper
const loadedImgCache = new Map<number, HTMLImageElement>()

async function loadImageById(id: number): Promise<HTMLImageElement | null> {
  if (id <= 0) return null
  if (loadedImgCache.has(id)) return loadedImgCache.get(id)!

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      loadedImgCache.set(id, img)
      resolve(img)
    }
    img.onerror = () => {
      resolve(null)
    }
    img.src = `/source-media/Small/${id}.png`
  })
}

function getSafeFrame(part: NsoPart | undefined | null, frameIndex: number): NsoPartImage | null {
  if (!part || !part.part || part.part.length === 0) return null
  const len = part.part.length
  const cand = part.part[frameIndex % len]
  if (cand && cand.id > 0) return cand
  const fallback = part.part.find((f) => f.id > 0)
  return fallback || cand || null
}

async function bakeSpritesheet() {
  baking.value = true
  sheetPreviewUrl.value = null

  try {
    const actKey = selectedAction.value
    const seq = props.actionSequences[actKey]
    if (!seq) throw new Error(`Không tìm thấy cấu hình cho hành động ${actKey}`)

    // List of all step items for this single action
    const stepsQueue: Array<{
      action: string
      stepIndex: number
      lungeX: number
      jumpY: number
      breathBob: number
      neckOffset: number
      waistOffset: number
      headOffset: { dx: number; dy: number }
      bodyOffset: { dx: number; dy: number }
      legOffset: { dx: number; dy: number }
      weaponOffset: { dx: number; dy: number; rot: number }
      zIndices: { head: number; body: number; leg: number; weapon: number; mask: number }
      legF: NsoPartImage | null
      bodyF: NsoPartImage | null
      headF: NsoPartImage | null
      weaponF: NsoPartImage | null
    }> = []

    for (let s = 0; s < seq.steps; s++) {
      const legF = getSafeFrame(props.parts.leg, seq.getLegFrame(s))
      const bodyF = getSafeFrame(props.parts.body, seq.getBodyFrame(s))
      const headF = getSafeFrame(props.parts.head, seq.getHeadFrame(s))
      const weaponF = getSafeFrame(props.parts.weapon, seq.getWeaponFrame(s))
      const weaponOffset = seq.weaponOffsets ? (seq.weaponOffsets[s] ?? { dx: 0, dy: 0, rot: 0 }) : { dx: 0, dy: 0, rot: 0 }
      const neckOffset = seq.neckOffsets ? (seq.neckOffsets[s] ?? 0) : 0
      const waistOffset = seq.waistOffsets ? (seq.waistOffsets[s] ?? 0) : 0
      const headOffset = seq.headOffsets ? (seq.headOffsets[s] ?? { dx: 0, dy: 0 }) : { dx: 0, dy: 0 }
      const bodyOffset = seq.bodyOffsets ? (seq.bodyOffsets[s] ?? { dx: 0, dy: 0 }) : { dx: 0, dy: 0 }
      const legOffset = seq.legOffsets ? (seq.legOffsets[s] ?? { dx: 0, dy: 0 }) : { dx: 0, dy: 0 }
      const zIndices = seq.zIndices ? (seq.zIndices[s] ?? { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }) : { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }
      const lungeX = seq.lungeX ? (seq.lungeX[s] ?? 0) : 0
      const jumpY = seq.jumpY ? (seq.jumpY[s] ?? 0) : 0
      const breathBob = seq.breathBob ? (seq.breathBob[s] ?? 0) : 0

      stepsQueue.push({
        action: actKey,
        stepIndex: s,
        lungeX,
        jumpY,
        breathBob,
        neckOffset,
        waistOffset,
        headOffset,
        bodyOffset,
        legOffset,
        weaponOffset,
        zIndices,
        legF,
        bodyF,
        headF,
        weaponF,
      })
    }

    // 2. Preload all needed image elements
    const idsToPreload = new Set<number>()
    for (const item of stepsQueue) {
      if (item.legF && item.legF.id > 0) idsToPreload.add(item.legF.id)
      if (item.bodyF && item.bodyF.id > 0) idsToPreload.add(item.bodyF.id)
      if (item.headF && item.headF.id > 0) idsToPreload.add(item.headF.id)
      if (item.weaponF && item.weaponF.id > 0) idsToPreload.add(item.weaponF.id)
    }

    await Promise.all(Array.from(idsToPreload).map((id) => loadImageById(id)))

    // 3. Setup Canvas dimensions
    const baseW = 100
    const baseH = 110
    const scale = bakeScale.value
    const cellW = baseW * scale
    const cellH = baseH * scale
    const totalFrames = stepsQueue.length
    const sheetW = cellW * totalFrames
    const sheetH = cellH

    const canvas = document.createElement('canvas')
    canvas.width = sheetW
    canvas.height = sheetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context')

    ctx.imageSmoothingEnabled = false

    if (bakeBackground.value === 'dark') {
      ctx.fillStyle = '#101416'
      ctx.fillRect(0, 0, sheetW, sheetH)
    } else {
      ctx.clearRect(0, 0, sheetW, sheetH)
    }

    const anchorCenterX = Math.floor(baseW / 2)
    const anchorGroundY = 88

    const framesMeta: any[] = []

    // 4. Render each frame step
    for (let i = 0; i < stepsQueue.length; i++) {
      const item = stepsQueue[i]!
      const cellOffsetX = i * cellW

      const getDim = (id: number | undefined) => {
        if (!id || id <= 0) return { w: 60, h: 32 }
        if (props.spriteDimensions[id]) return props.spriteDimensions[id]!
        const img = loadedImgCache.get(id)
        if (img && img.naturalWidth) return { w: img.naturalWidth, h: img.naturalHeight }
        return { w: 84, h: 44 }
      }

      const legDim = getDim(item.legF?.id)
      const bodyDim = getDim(item.bodyF?.id)
      const headDim = getDim(item.headF?.id)

      const legDx = (item.legF ? item.legF.dx : 0) + item.legOffset.dx
      const legDy = (item.legF ? item.legF.dy : 0) + item.legOffset.dy
      const legTop = anchorGroundY - legDim.h + legDy + item.jumpY
      const legLeft = anchorCenterX - Math.floor(legDim.w / 2) + legDx + item.lungeX

      const bodyDx = (item.bodyF ? item.bodyF.dx : 0) + item.bodyOffset.dx
      const bodyDy = (item.bodyF ? item.bodyF.dy : 0) + item.bodyOffset.dy
      const effWaist = props.waistOverlap + item.waistOffset
      const bodyTop = legTop - bodyDim.h + effWaist + bodyDy + item.breathBob
      const bodyLeft = anchorCenterX - Math.floor(bodyDim.w / 2) + bodyDx + item.lungeX

      const headDx = (item.headF ? item.headF.dx : 0) + item.headOffset.dx
      const headDy = (item.headF ? item.headF.dy : 0) + item.headOffset.dy
      const effNeck = props.neckOverlap + item.neckOffset
      const headTop = bodyTop - headDim.h + effNeck + headDy + item.breathBob
      const headLeft = anchorCenterX - Math.floor(headDim.w / 2) + headDx + item.lungeX

      const weaponDx = item.weaponF ? item.weaponF.dx : 0
      const weaponDy = item.weaponF ? item.weaponF.dy : 0
      const weaponTop = bodyTop + 8 + weaponDy + item.weaponOffset.dy
      const weaponLeft = anchorCenterX + 4 + weaponDx + item.lungeX + item.weaponOffset.dx

      const drawPart = (imgId: number | undefined, top: number, left: number, rot = 0) => {
        if (!imgId || imgId <= 0) return
        const img = loadedImgCache.get(imgId)
        if (!img) return
        ctx.save()
        if (rot !== 0) {
          const pivotX = cellOffsetX + (left + img.naturalWidth * 0.25) * scale
          const pivotY = (top + img.naturalHeight * 0.75) * scale
          ctx.translate(pivotX, pivotY)
          ctx.rotate((rot * Math.PI) / 180)
          ctx.drawImage(img, -img.naturalWidth * 0.25 * scale, -img.naturalHeight * 0.75 * scale, img.naturalWidth * scale, img.naturalHeight * scale)
        } else {
          ctx.drawImage(img, cellOffsetX + left * scale, top * scale, img.naturalWidth * scale, img.naturalHeight * scale)
        }
        ctx.restore()
      }

      // Calculate effective rendering order based on per-step z-index
      const getEffectiveZ = (cat: 'head' | 'body' | 'leg' | 'weapon' | 'mask') => {
        const userZ = item.zIndices?.[cat] ?? 1
        const tieBreakers = {
          leg: 20,
          body: 30,
          weapon: props.weaponLayerOrder === 'behind' ? 15 : 35,
          head: 40,
          mask: 50,
        }
        return (userZ * 100) + tieBreakers[cat]
      }

      const drawQueue = [
        { z: getEffectiveZ('leg'), draw: () => drawPart(item.legF?.id, legTop, legLeft) },
        { z: getEffectiveZ('body'), draw: () => drawPart(item.bodyF?.id, bodyTop, bodyLeft) },
        { z: getEffectiveZ('weapon'), draw: () => drawPart(item.weaponF?.id, weaponTop, weaponLeft, item.weaponOffset.rot) },
        { z: getEffectiveZ('head'), draw: () => drawPart(item.headF?.id, headTop, headLeft) },
      ]
      drawQueue.sort((a, b) => a.z - b.z).forEach((d) => d.draw())

      framesMeta.push({
        frameIndex: i,
        action: item.action,
        stepIndex: item.stepIndex,
        x: cellOffsetX,
        y: 0,
        w: cellW,
        h: cellH,
        pivotX: 0.5,
        pivotY: (anchorGroundY / baseH),
        lungeX: item.lungeX,
        jumpY: item.jumpY,
      })
    }

    sheetPreviewUrl.value = canvas.toDataURL('image/png')
    sheetDimensions.value = {
      w: sheetW,
      h: sheetH,
      framesCount: totalFrames,
      frameW: cellW,
      frameH: cellH,
    }

    sheetMetadataJson.value = {
      meta: {
        generator: 'Game Asset Studio - NSO Single Action Spritesheet Baker',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        action: selectedAction.value,
        actionLabel: actionLabels[selectedAction.value].label,
        scale,
        totalFrames,
        frameWidth: cellW,
        frameHeight: cellH,
        fps: props.fps,
      },
      loadout: props.loadout,
      frames: framesMeta,
    }
  } catch (err: any) {
    console.error('Lỗi bake spritesheet:', err)
    alert(`Lỗi khi tạo spritesheet: ${err.message}`)
  } finally {
    baking.value = false
  }
}

function downloadBakedPng() {
  if (!sheetPreviewUrl.value) return
  const a = document.createElement('a')
  a.href = sheetPreviewUrl.value
  a.download = `character_${selectedAction.value}_spritesheet.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadBakedMetadataJson() {
  if (!sheetMetadataJson.value) return
  const blob = new Blob([JSON.stringify(sheetMetadataJson.value, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `character_${selectedAction.value}_metadata.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ==================== TAB 2: PARTS TEXTURE ATLAS (1 PNG TO GỘP CÁC MẢNH NHỎ) ====================
const atlasScope = ref<'action' | 'loadout'>('action')
const atlasMaxWidth = ref<number>(256)
const atlasPadding = ref<number>(4)
const atlasBackground = ref<'transparent' | 'dark'>('transparent')
const generatingAtlas = ref(false)
const atlasPreviewUrl = ref<string | null>(null)
const atlasMetadataJson = ref<any | null>(null)
const showAtlasSliceOverlay = ref(true)
const atlasStats = ref<{ w: number; h: number; count: number }>({ w: 0, h: 0, count: 0 })
const placedAtlasSprites = ref<
  Array<{
    id: number
    category: string
    name: string
    frames: number[]
    dx: number
    dy: number
    x: number
    y: number
    w: number
    h: number
  }>
>([])
const copiedCSharpToast = ref(false)

function setAtlasScope(scope: 'action' | 'loadout') {
  atlasScope.value = scope
  if (atlasPreviewUrl.value) {
    generatePartsAtlas()
  }
}

// Tự động vẽ lại Atlas khi người dùng đổi hoạt ảnh (nếu đang ở chế độ 'action')
watch(selectedAction, () => {
  if (atlasScope.value === 'action' && atlasPreviewUrl.value) {
    generatePartsAtlas()
  }
})

async function generatePartsAtlas() {
  generatingAtlas.value = true
  atlasPreviewUrl.value = null

  try {
    const collectedMap = new Map<number, {
      id: number
      category: 'head' | 'body' | 'leg' | 'weapon' | 'mask'
      frames: number[]
      dx: number
      dy: number
    }>()

    if (atlasScope.value === 'action') {
      // 🎯 CHỈ GỘP CÁC MẢNH SPRITE THỰC TẾ DÙNG TRONG HOẠT ẢNH HIỆN TẠI (TỐI ƯU GỌN NHẤT)
      const actKey = selectedAction.value
      const seq = props.actionSequences[actKey]
      if (!seq) throw new Error(`Không tìm thấy cấu hình cho hành động ${actKey}`)

      for (let s = 0; s < seq.steps; s++) {
        const legF = getSafeFrame(props.parts.leg, seq.getLegFrame(s))
        const bodyF = getSafeFrame(props.parts.body, seq.getBodyFrame(s))
        const headF = getSafeFrame(props.parts.head, seq.getHeadFrame(s))
        const weaponF = getSafeFrame(props.parts.weapon, seq.getWeaponFrame(s))
        const maskF = props.parts.mask ? getSafeFrame(props.parts.mask, seq.getHeadFrame(s)) : null

        const stepFrames = [
          { f: legF, cat: 'leg' as const },
          { f: bodyF, cat: 'body' as const },
          { f: headF, cat: 'head' as const },
          { f: weaponF, cat: 'weapon' as const },
          { f: maskF, cat: 'mask' as const },
        ]

        for (const item of stepFrames) {
          if (item.f && item.f.id > 0) {
            if (!collectedMap.has(item.f.id)) {
              collectedMap.set(item.f.id, {
                id: item.f.id,
                category: item.cat,
                frames: [s],
                dx: item.f.dx,
                dy: item.f.dy,
              })
            } else {
              const existing = collectedMap.get(item.f.id)!
              if (!existing.frames.includes(s)) {
                existing.frames.push(s)
              }
            }
          }
        }
      }
    } else {
      // 🌐 GỘP TOÀN BỘ CÁC MẢNH CỦA TRANG PHỤC ĐANG TRANG BỊ
      const catKeys: Array<'head' | 'body' | 'leg' | 'weapon' | 'mask'> = ['head', 'body', 'leg', 'weapon', 'mask']
      for (const cat of catKeys) {
        const p = props.parts[cat]
        if (p && Array.isArray(p.part)) {
          p.part.forEach((f, fIdx) => {
            if (f && f.id > 0) {
              if (!collectedMap.has(f.id)) {
                collectedMap.set(f.id, {
                  id: f.id,
                  category: cat,
                  frames: [fIdx],
                  dx: f.dx,
                  dy: f.dy,
                })
              } else {
                collectedMap.get(f.id)!.frames.push(fIdx)
              }
            }
          })
        }
      }
    }

    const uniqueSprites = Array.from(collectedMap.values())
    if (uniqueSprites.length === 0) {
      throw new Error('Không tìm thấy sprite bộ phận nào để tạo Atlas.')
    }

    // Preload toàn bộ ảnh nhỏ
    await Promise.all(uniqueSprites.map((s) => loadImageById(s.id)))

    const pad = atlasPadding.value
    const maxW = atlasMaxWidth.value

    const spriteItems = uniqueSprites.map((s) => {
      const img = loadedImgCache.get(s.id)
      const w = img?.naturalWidth || props.spriteDimensions[s.id]?.w || 40
      const h = img?.naturalHeight || props.spriteDimensions[s.id]?.h || 32
      return { ...s, w, h }
    })

    // Sắp xếp các sprite theo chiều cao giảm dần để xếp tối ưu (Shelf Packing)
    spriteItems.sort((a, b) => b.h - a.h)

    let curX = pad
    let curY = pad
    let rowH = 0
    let totalMaxW = 0
    const placed: Array<{
      id: number
      category: string
      name: string
      frames: number[]
      dx: number
      dy: number
      x: number
      y: number
      w: number
      h: number
    }> = []

    for (const item of spriteItems) {
      if (curX + item.w + pad > maxW && curX > pad) {
        curX = pad
        curY += rowH + pad
        rowH = 0
      }

      placed.push({
        ...item,
        name: `part_${item.category}_${item.id}`,
        x: curX,
        y: curY,
      })

      curX += item.w + pad
      totalMaxW = Math.max(totalMaxW, curX)
      rowH = Math.max(rowH, item.h)
    }

    const finalAtlasW = Math.max(maxW, totalMaxW)
    const finalAtlasH = curY + rowH + pad

    const canvas = document.createElement('canvas')
    canvas.width = finalAtlasW
    canvas.height = finalAtlasH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context')
    ctx.imageSmoothingEnabled = false

    if (atlasBackground.value === 'dark') {
      ctx.fillStyle = '#101416'
      ctx.fillRect(0, 0, finalAtlasW, finalAtlasH)
    } else {
      ctx.clearRect(0, 0, finalAtlasW, finalAtlasH)
    }

    for (const p of placed) {
      const img = loadedImgCache.get(p.id)
      if (img) {
        ctx.drawImage(img, p.x, p.y, p.w, p.h)
      }
    }

    atlasPreviewUrl.value = canvas.toDataURL('image/png')
    placedAtlasSprites.value = placed
    atlasStats.value = {
      w: finalAtlasW,
      h: finalAtlasH,
      count: placed.length,
    }

    const isActionScope = atlasScope.value === 'action'
    const baseFilename = isActionScope
      ? `character_${selectedAction.value}_parts_atlas`
      : `character_loadout_full_atlas`

    atlasMetadataJson.value = {
      meta: {
        generator: 'Game Asset Studio - NSO Parts Texture Atlas Exporter',
        version: '1.1',
        exportedAt: new Date().toISOString(),
        scope: atlasScope.value,
        action: isActionScope ? selectedAction.value : 'all',
        actionLabel: isActionScope ? actionLabels[selectedAction.value].label : 'Toàn bộ trang phục loadout',
        textureName: `${baseFilename}.png`,
        width: finalAtlasW,
        height: finalAtlasH,
        padding: pad,
        totalSprites: placed.length,
        skinSwapping: {
          strategy: isActionScope ? 'Per-Action/Per-Set Texture Swap' : 'Global Loadout Atlas',
          instructions: 'Để đổi trang phục/skin trong Unity: thay texture gán vào Sprite.Create hoặc dùng gói Modular ZIP (Tab 1) kết hợp Unity Sprite Atlas.',
        },
        unityGuidelines: {
          textureType: 'Sprite (2D and UI)',
          spriteMode: 'Multiple',
          filterMode: 'Point (no filter)',
          meshType: 'Full Rect',
          compression: 'None',
        },
      },
      loadout: props.loadout,
      sprites: placed.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        usedInFrames: p.frames,
        pixelRect: {
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
        },
        unityRect: {
          x: p.x,
          y: finalAtlasH - p.y - p.h, // Đổi tọa độ Y theo chuẩn gốc Bottom-Left của Unity
          width: p.w,
          height: p.h,
        },
        pivot: { x: 0.5, y: 0.5 },
        nsoOffset: { dx: p.dx, dy: p.dy },
      })),
    }
  } catch (err: any) {
    console.error('Lỗi tạo Atlas:', err)
    alert(`Lỗi: ${err.message}`)
  } finally {
    generatingAtlas.value = false
  }
}

function downloadAtlasPng() {
  if (!atlasPreviewUrl.value) return
  const isActionScope = atlasScope.value === 'action'
  const fileName = isActionScope
    ? `character_${selectedAction.value}_parts_atlas.png`
    : `character_loadout_full_atlas.png`
  const a = document.createElement('a')
  a.href = atlasPreviewUrl.value
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadAtlasJson() {
  if (!atlasMetadataJson.value) return
  const isActionScope = atlasScope.value === 'action'
  const fileName = isActionScope
    ? `character_${selectedAction.value}_parts_atlas.json`
    : `character_loadout_full_atlas.json`
  const blob = new Blob([JSON.stringify(atlasMetadataJson.value, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyCSharpAtlasScript() {
  const csharpCode = `using UnityEngine;
using System.Collections.Generic;

// Script C# tự động đọc character_parts_atlas.png và cắt Sprite theo tọa độ JSON
public class NsoCharacterAtlasLoader : MonoBehaviour
{
    [Header("Gán file Texture Atlas và JSON")]
    public Texture2D atlasTexture;
    public TextAsset atlasJson;

    [System.Serializable]
    public class UnityRectData { public float x, y, width, height; }

    [System.Serializable]
    public class SpriteItemData
    {
        public int id;
        public string name;
        public string category;
        public UnityRectData unityRect;
    }

    [System.Serializable]
    public class AtlasRootData
    {
        public SpriteItemData[] sprites;
    }

    public Dictionary<int, Sprite> LoadAtlasSprites()
    {
        var dict = new Dictionary<int, Sprite>();
        if (atlasTexture == null || atlasJson == null)
        {
            Debug.LogError("[NsoAtlasLoader] Chưa gán atlasTexture hoặc atlasJson!");
            return dict;
        }

        var root = JsonUtility.FromJson<AtlasRootData>(atlasJson.text);
        foreach (var item in root.sprites)
        {
            Rect rect = new Rect(item.unityRect.x, item.unityRect.y, item.unityRect.width, item.unityRect.height);
            Sprite sprite = Sprite.Create(atlasTexture, rect, new Vector2(0.5f, 0.5f), 100f);
            sprite.name = item.name;
            dict[item.id] = sprite;
        }
        Debug.Log($"[NsoAtlasLoader] Đã tải thành công {dict.Count} sprites từ Atlas!");
        return dict;
    }
}`;

  try {
    await navigator.clipboard.writeText(csharpCode)
    copiedCSharpToast.value = true
    setTimeout(() => {
      copiedCSharpToast.value = false
    }, 2500)
  } catch (e) {
    console.error('Không thể copy C# script:', e)
  }
}
</script>

<template>
  <div class="export-modal-backdrop" @click.self="$emit('close')">
    <div class="export-modal-dialog">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title-box">
          <span class="header-icon">🎮</span>
          <div>
            <h3 class="header-title">Xuất Hoạt Ảnh Cho Unity C# (Option D Hybrid)</h3>
            <p class="header-sub">
              Xuất riêng từng hoạt ảnh để dễ dàng quản lý Animation Clip trong Unity
            </p>
          </div>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Single Action Selector Strip (Chỉ xuất 1 animation trong 1 lần) -->
      <div class="action-export-selector">
        <span class="aes-label">Chọn hoạt ảnh cần xuất:</span>
        <div class="aes-buttons">
          <button
            v-for="actKey in (['idle', 'walk', 'attack', 'jump'] as const)"
            :key="actKey"
            class="btn-act-sel"
            :class="{ active: selectedAction === actKey }"
            @click="selectedAction = actKey"
          >
            {{ actionLabels[actKey].icon }} {{ actionLabels[actKey].label }}
          </button>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="modal-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'modular' }"
          @click="activeTab = 'modular'"
        >
          🧩 1. Modular JSON & Gói ZIP
          <span class="badge-rec">Khuyên dùng</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'atlas' }"
          @click="activeTab = 'atlas'"
        >
          📦 2. Atlas Mảnh Chi Tiết (1 PNG To)
          <span class="badge-atlas">Mới</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'baked' }"
          @click="activeTab = 'baked'"
        >
          🎞️ 3. Baked Animation Spritesheet
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- ==================== TAB 1: MODULAR JSON ==================== -->
        <div v-if="activeTab === 'modular'" class="tab-content">
          <div class="info-alert">
            💡 <b>Đang xuất hoạt ảnh:</b> {{ actionLabels[selectedAction].icon }} <b>{{ actionLabels[selectedAction].label }}</b>.
            Tất cả frame, nhịp, độ bù khớp cổ, khớp eo và độ tịnh tiến (lungeX, jumpY) đã được tính toán đồng bộ.
          </div>

          <!-- Current Loadout Summary -->
          <div class="loadout-summary-strip">
            <span class="strip-label">Đang trang bị:</span>
            <div class="loadout-tag">🧢 Đầu #{{ loadout.headId }}</div>
            <div class="loadout-tag">🥋 Thân #{{ loadout.bodyId }}</div>
            <div class="loadout-tag">👖 Chân #{{ loadout.legId }}</div>
            <div class="loadout-tag">⚔️ Kiếm #{{ loadout.weaponId }}</div>
            <div class="loadout-tag meta-tag">⚡ FPS: {{ fps }}</div>
          </div>

          <!-- JSON Viewer -->
          <div class="code-box-wrapper">
            <div class="code-box-header">
              <span class="file-tag">📄 character_{{ selectedAction }}.json</span>
              <button class="btn-copy" @click="copyJsonToClipboard">
                {{ copiedToast ? '✅ Đã sao chép!' : '📋 Sao chép JSON' }}
              </button>
            </div>
            <pre class="code-box"><code>{{ jsonString }}</code></pre>
          </div>

          <!-- Server Zip Status -->
          <div v-if="zipSuccessUrl" class="success-alert">
            ✅ <b>Đã đóng gói thành công:</b> {{ zipFilename }} (Đã gồm {{ zipCopiedCount }} file ảnh PNG sprites).
            <br />
            <a :href="zipSuccessUrl" class="link-download" download>Bấm vào đây để tải lại nếu trình duyệt chưa tải</a>
          </div>

          <div v-if="zipError" class="error-alert">
            ❌ {{ zipError }}
          </div>
        </div>

        <!-- ==================== TAB 2: PARTS TEXTURE ATLAS ==================== -->
        <div v-if="activeTab === 'atlas'" class="tab-content">
          <div class="info-alert">
            💡 <b>Texture Atlas:</b> Gom các ảnh PNG chi tiết nhỏ thành <b>1 file ảnh PNG to duy nhất</b>.
            Trong Unity, chỉ cần chọn Sprite Mode: <b>Multiple</b> và import file tọa độ Slice JSON để tự động cắt sprite theo chuẩn pixel.
          </div>

          <!-- Atlas Scope Selector -->
          <div class="atlas-scope-strip">
            <div class="ass-header">
              <span class="ass-label">Phạm vi gộp ảnh (Atlas Scope):</span>
              <span v-if="atlasScope === 'action'" class="ass-hint">
                Đang lọc chỉ các mảnh dùng trong hoạt ảnh <b>{{ actionLabels[selectedAction].label }}</b>
              </span>
              <span v-else class="ass-hint">
                Đang gộp toàn bộ tất cả mảnh của các món trang phục đang đeo
              </span>
            </div>
            <div class="ass-buttons">
              <button
                class="btn-scope-pill"
                :class="{ active: atlasScope === 'action' }"
                @click="setAtlasScope('action')"
              >
                🎯 Chỉ hoạt ảnh {{ actionLabels[selectedAction].label }} (Khuyên dùng)
              </button>
              <button
                class="btn-scope-pill"
                :class="{ active: atlasScope === 'loadout' }"
                @click="setAtlasScope('loadout')"
              >
                🌐 Toàn bộ trang phục (Tất cả mảnh của set đồ)
              </button>
            </div>
          </div>

          <!-- Atlas Settings Grid -->
          <div class="bake-settings-grid">
            <div class="setting-item">
              <label>Độ rộng tối đa (Max Width):</label>
              <select v-model.number="atlasMaxWidth" class="select-field">
                <option :value="256">256px (Chuẩn GPU Di Động - Gọn)</option>
                <option :value="512">512px (Rộng rãi - Ít hàng)</option>
                <option :value="1024">1024px (Siêu rộng)</option>
              </select>
            </div>

            <div class="setting-item">
              <label>Khoảng cách (Padding):</label>
              <select v-model.number="atlasPadding" class="select-field">
                <option :value="2">2px (Tiết kiệm diện tích)</option>
                <option :value="4">4px (Khuyên dùng - Tránh lem pixel)</option>
                <option :value="8">8px (Rộng)</option>
              </select>
            </div>

            <div class="setting-item">
              <label>Màu nền xuất:</label>
              <select v-model="atlasBackground" class="select-field">
                <option value="transparent">Trong suốt (Transparent PNG)</option>
                <option value="dark">Nền tối Studio (#101416)</option>
              </select>
            </div>

            <div class="setting-item action-col">
              <button class="btn-bake" :disabled="generatingAtlas" @click="generatePartsAtlas">
                {{ generatingAtlas ? '⏳ Đang ghép ảnh...' : '⚡ TẠO ATLAS ẢNH TO (1 PNG)' }}
              </button>
            </div>
          </div>

          <!-- Atlas Preview Card -->
          <div v-if="atlasPreviewUrl" class="sheet-preview-card">
            <div class="preview-header">
              <span class="preview-title">
                📦 Kết quả: {{ atlasStats.w }}x{{ atlasStats.h }}px ({{ atlasStats.count }} mảnh sprite {{ atlasScope === 'action' ? `cho ${actionLabels[selectedAction].label}` : 'toàn bộ set đồ' }})
              </span>
              <label class="toggle-overlay-lbl">
                <input v-model="showAtlasSliceOverlay" type="checkbox" />
                <span>Hiện ô viền & ID từng mảnh</span>
              </label>
            </div>

            <div class="preview-scroll-viewport atlas-viewport">
              <div
                class="atlas-canvas-wrapper"
                :style="{ width: `${atlasStats.w}px`, height: `${atlasStats.h}px` }"
              >
                <img :src="atlasPreviewUrl" class="preview-atlas-img" />
                <template v-if="showAtlasSliceOverlay">
                  <div
                    v-for="s in placedAtlasSprites"
                    :key="s.id"
                    class="atlas-slice-box"
                    :style="{
                      left: `${s.x}px`,
                      top: `${s.y}px`,
                      width: `${s.w}px`,
                      height: `${s.h}px`,
                    }"
                    :title="`Sprite #${s.id} (${s.category}) | ${s.w}x${s.h}px | Rect: (${s.x}, ${s.y})`"
                  >
                    <span class="slice-tag">#{{ s.id }}</span>
                  </div>
                </template>
              </div>
            </div>

            <div class="preview-actions-row">
              <button class="btn-download-action" @click="downloadAtlasPng">
                ⬇️ Tải Ảnh Atlas (.png)
              </button>
              <button class="btn-download-action btn-sec" @click="downloadAtlasJson">
                ⬇️ Tải Metadata Slice (.json)
              </button>
              <button class="btn-download-action btn-sec" @click="copyCSharpAtlasScript">
                {{ copiedCSharpToast ? '✅ Đã copy C# Script!' : '📋 Copy C# Script Import' }}
              </button>
            </div>

            <!-- Quick Unity Guidelines Note -->
            <div class="atlas-quick-guide">
              <div class="aqg-title">💡 Hướng Dẫn Unity & Khả Năng Thay Đổi Trang Phục (Skin Swap):</div>
              <ol class="aqg-steps">
                <li>Copy file PNG vào <code>Assets/Resources/Sprites/</code>, đặt <b>Texture Type = Sprite (2D and UI)</b>, <b>Sprite Mode = Multiple</b>, <b>Filter Mode = Point (no filter)</b>.</li>
                <li>Bấm <b>"Copy C# Script Import"</b> ở trên gắn vào Unity để tự động cắt sprite theo tọa độ JSON (hỗ trợ trục tọa độ Bottom-Left của Unity).</li>
                <li><b>Thay đổi trang phục (Skin Swap):</b>
                  <br />• <i>Cách 1 (Khuyên dùng):</i> Xuất Texture Atlas riêng cho từng Set đồ (Trang phục 1, Trang phục 2...). Trong C# chỉ cần đổi Texture truyền vào script là nhân vật đổi đồ lập tức mà không tốn bộ nhớ.
                  <br />• <i>Cách 2 (Modular độc lập từng món):</i> Dùng gói Tab 1 (Modular ZIP) kết hợp tính năng <b>Sprite Atlas</b> của Unity để tùy biến thay riêng mũ, áo, kiếm tùy ý.
                </li>
              </ol>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 3: BAKED SPRITESHEET ==================== -->
        <div v-if="activeTab === 'baked'" class="tab-content">
          <div class="info-alert">
            💡 <b>Ghép ảnh Spritesheet cho:</b> {{ actionLabels[selectedAction].icon }} <b>{{ actionLabels[selectedAction].label }}</b>.
            Studio chụp và ghép các bộ phận thành 1 dải PNG duy nhất cho riêng hành động này.
          </div>

          <!-- Baking Options Form -->
          <div class="bake-settings-grid">
            <div class="setting-item">
              <label>Hoạt ảnh đang xuất:</label>
              <div class="active-action-pill">
                {{ actionLabels[selectedAction].icon }} {{ actionLabels[selectedAction].label }}
              </div>
            </div>

            <div class="setting-item">
              <label>Độ phân giải (Scale):</label>
              <select v-model.number="bakeScale" class="select-field">
                <option :value="1">1x (Pixel Gốc NSO - 100x110px/frame)</option>
                <option :value="2">2x (Sắc nét HD - 200x220px/frame)</option>
              </select>
            </div>

            <div class="setting-item">
              <label>Màu nền xuất:</label>
              <select v-model="bakeBackground" class="select-field">
                <option value="transparent">Trong suốt (Transparent PNG)</option>
                <option value="dark">Nền tối Studio (#101416)</option>
              </select>
            </div>

            <div class="setting-item action-col">
              <button class="btn-bake" :disabled="baking" @click="bakeSpritesheet">
                {{ baking ? '⏳ Đang ghép ảnh...' : '⚡ BAKE SPRITESHEET' }}
              </button>
            </div>
          </div>

          <!-- Spritesheet Preview -->
          <div v-if="sheetPreviewUrl" class="sheet-preview-card">
            <div class="preview-header">
              <span class="preview-title">
                🖼️ Kết quả: {{ sheetDimensions.w }}x{{ sheetDimensions.h }}px ({{ sheetDimensions.framesCount }} frames)
              </span>
              <span class="preview-tag">Mỗi ô: {{ sheetDimensions.frameW }}x{{ sheetDimensions.frameH }}px</span>
            </div>

            <div class="preview-scroll-viewport">
              <img :src="sheetPreviewUrl" class="preview-spritesheet-img" />
            </div>

            <div class="preview-actions-row">
              <button class="btn-download-action" @click="downloadBakedPng">
                ⬇️ Tải Ảnh Spritesheet (.png)
              </button>
              <button class="btn-download-action btn-sec" @click="downloadBakedMetadataJson">
                ⬇️ Tải Slice Metadata (.json)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn-close-modal" @click="$emit('close')">Đóng</button>

        <!-- Footer Actions for Tab 1 -->
        <template v-if="activeTab === 'modular'">
          <button class="btn-action-sec" @click="downloadJsonFile">
            ⬇️ Tải file JSON Trực Tiếp
          </button>
          <button
            class="btn-action-primary"
            :disabled="packagingZip"
            @click="downloadZipPackage"
          >
            {{ packagingZip ? '⏳ Đang đóng gói ZIP...' : `📦 Tải ZIP (${selectedAction.toUpperCase()})` }}
          </button>
        </template>

        <!-- Footer Actions for Tab 2: Atlas -->
        <template v-if="activeTab === 'atlas' && atlasPreviewUrl">
          <button class="btn-action-sec" @click="downloadAtlasJson">
            ⬇️ Tải JSON Tọa Độ Atlas
          </button>
          <button class="btn-action-primary" @click="downloadAtlasPng">
            📦 Tải Atlas PNG ({{ atlasScope === 'action' ? selectedAction.toUpperCase() : 'FULL LOADOUT' }})
          </button>
        </template>

        <!-- Footer Actions for Tab 3: Baked Spritesheet -->
        <template v-if="activeTab === 'baked' && sheetPreviewUrl">
          <button class="btn-action-sec" @click="downloadBakedMetadataJson">
            ⬇️ Tải Slice JSON
          </button>
          <button class="btn-action-primary" @click="downloadBakedPng">
            🖼️ Tải Spritesheet PNG
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
  backdrop-filter: blur(3px);
  padding: 16px;
}

.export-modal-dialog {
  width: 820px;
  max-width: 96vw;
  max-height: 90vh;
  background-color: #171d1f;
  border: 1px solid #344143;
  border-radius: 6px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.modal-header {
  padding: 14px 18px;
  background-color: #13191b;
  border-bottom: 1px solid #344143;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
}

.header-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #e9efeb;
}

.header-sub {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: #98a6a1;
}

.btn-close {
  background: transparent;
  border: none;
  color: #98a6a1;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
}

.btn-close:hover {
  color: #e9efeb;
  background-color: #20282a;
}

/* Action Selector Strip */
.action-export-selector {
  padding: 10px 18px;
  background-color: #13191b;
  border-bottom: 1px solid #252e31;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.aes-label {
  font-size: 11px;
  font-weight: 600;
  color: #8fa0a5;
}

.aes-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-act-sel {
  background: #1c2326;
  border: 1px solid #344143;
  color: #c4d0d4;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-act-sel:hover {
  border-color: #4a5c60;
  color: #e0e6e8;
}

.btn-act-sel.active {
  background: #252e31;
  border-color: #b9f36b;
  color: #b9f36b;
  box-shadow: 0 0 8px rgba(185, 243, 107, 0.25);
}

/* Tabs */
.modal-tabs {
  display: flex;
  background-color: #101416;
  border-bottom: 1px solid #344143;
}

.tab-btn {
  flex: 1;
  padding: 11px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #98a6a1;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #e9efeb;
  background-color: #171d1f;
}

.tab-btn.active {
  color: #b9f36b;
  border-bottom-color: #b9f36b;
  background-color: #171d1f;
}

.badge-rec {
  background-color: rgba(185, 243, 107, 0.15);
  color: #b9f36b;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(185, 243, 107, 0.3);
}

/* Body */
.modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-alert {
  background-color: rgba(64, 93, 114, 0.18);
  border: 1px solid #344143;
  padding: 10px 14px;
  border-radius: 5px;
  font-size: 11px;
  color: #c4d0d4;
  line-height: 1.5;
}

.loadout-summary-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background-color: #101416;
  border-radius: 5px;
  border: 1px solid #283335;
}

.strip-label {
  font-size: 11px;
  color: #8fa0a5;
  font-weight: 600;
}

.loadout-tag {
  background-color: #1e2629;
  border: 1px solid #344143;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #e0e6e8;
}

.loadout-tag.meta-tag {
  color: #b9f36b;
  border-color: rgba(185, 243, 107, 0.3);
}

.code-box-wrapper {
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 5px;
  overflow: hidden;
}

.code-box-header {
  padding: 8px 12px;
  background-color: #13191b;
  border-bottom: 1px solid #283335;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-tag {
  font-size: 11px;
  font-weight: 600;
  color: #b9f36b;
  font-family: monospace;
}

.btn-copy {
  background-color: #1e2629;
  border: 1px solid #344143;
  color: #c4d0d4;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-copy:hover {
  color: #b9f36b;
  border-color: #b9f36b;
}

.code-box {
  margin: 0;
  padding: 12px;
  font-family: monospace;
  font-size: 11px;
  color: #98a6a1;
  max-height: 220px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}

.success-alert {
  padding: 10px 14px;
  background-color: rgba(185, 243, 107, 0.1);
  border: 1px solid #b9f36b;
  border-radius: 5px;
  color: #b9f36b;
  font-size: 11px;
  line-height: 1.5;
}

.link-download {
  color: #b9f36b;
  text-decoration: underline;
  font-weight: 600;
  margin-top: 4px;
  display: inline-block;
}

.error-alert {
  padding: 10px 14px;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  border-radius: 5px;
  color: #f87171;
  font-size: 11px;
}

/* Baking Settings */
.bake-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  background-color: #101416;
  padding: 14px;
  border-radius: 6px;
  border: 1px solid #344143;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-item label {
  font-size: 11px;
  color: #8fa0a5;
  font-weight: 600;
}

.active-action-pill {
  padding: 6px 10px;
  background: #1e2629;
  border: 1px solid #b9f36b;
  color: #b9f36b;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.select-field {
  padding: 6px 10px;
  background-color: #171d1f;
  border: 1px solid #344143;
  color: #e0e6e8;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.setting-item.action-col {
  justify-content: flex-end;
}

.btn-bake {
  padding: 8px 14px;
  background-color: #b9f36b;
  color: #101416;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-bake:hover:not(:disabled) {
  background-color: #cdf58f;
  box-shadow: 0 0 12px rgba(185, 243, 107, 0.4);
}

.btn-bake:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Sheet Preview */
.sheet-preview-card {
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-header {
  padding: 8px 12px;
  background-color: #13191b;
  border-bottom: 1px solid #283335;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-title {
  font-size: 11px;
  font-weight: 600;
  color: #e0e6e8;
}

.preview-tag {
  font-size: 10px;
  color: #8fa0a5;
  font-family: monospace;
}

.preview-scroll-viewport {
  padding: 16px;
  overflow-x: auto;
  background-color: #0b0e10;
  min-height: 120px;
  display: flex;
  align-items: center;
}

.preview-spritesheet-img {
  image-rendering: pixelated;
  max-height: 140px;
  border: 1px dashed #344143;
}

.preview-actions-row {
  padding: 10px 14px;
  background-color: #13191b;
  border-top: 1px solid #283335;
  display: flex;
  gap: 10px;
}

.btn-download-action {
  padding: 6px 14px;
  background-color: #b9f36b;
  color: #101416;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-download-action:hover {
  background-color: #cdf58f;
}

.btn-download-action.btn-sec {
  background-color: #1e2629;
  border: 1px solid #344143;
  color: #c4d0d4;
}

.btn-download-action.btn-sec:hover {
  border-color: #b9f36b;
  color: #b9f36b;
}

/* Footer */
.modal-footer {
  padding: 12px 18px;
  background-color: #13191b;
  border-top: 1px solid #344143;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
}

.btn-close-modal {
  padding: 7px 14px;
  background: transparent;
  border: 1px solid #344143;
  color: #98a6a1;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.btn-close-modal:hover {
  color: #e0e6e8;
  border-color: #4a5c60;
}

.btn-action-sec {
  padding: 7px 14px;
  background-color: #1e2629;
  border: 1px solid #344143;
  color: #e0e6e8;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.btn-action-sec:hover {
  border-color: #b9f36b;
  color: #b9f36b;
}

.btn-action-primary {
  padding: 7px 16px;
  background-color: #b9f36b;
  color: #101416;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-primary:hover:not(:disabled) {
  background-color: #cdf58f;
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.3);
}

.btn-action-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Atlas Tab Styles */
.badge-atlas {
  background-color: #2d2714;
  color: #f3ca6b;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #5a4a1c;
}

.atlas-scope-strip {
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ass-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ass-label {
  font-size: 11px;
  font-weight: 600;
  color: #8fa0a5;
}

.ass-hint {
  font-size: 10px;
  color: #98a6a1;
}

.ass-hint b {
  color: #b9f36b;
}

.ass-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-scope-pill {
  padding: 6px 12px;
  background-color: #171d1f;
  border: 1px solid #344143;
  color: #98a6a1;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-scope-pill:hover {
  border-color: #b9f36b;
  color: #e0e6e8;
}

.btn-scope-pill.active {
  background-color: #293a21;
  border-color: #b9f36b;
  color: #b9f36b;
  box-shadow: 0 0 8px rgba(185, 243, 107, 0.2);
}

.atlas-viewport {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background-color: #0e1214;
}

.atlas-canvas-wrapper {
  position: relative;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  border: 1px solid #344143;
}

.preview-atlas-img {
  display: block;
  image-rendering: pixelated;
}

.atlas-slice-box {
  position: absolute;
  border: 1px dashed rgba(185, 243, 107, 0.7);
  background-color: rgba(185, 243, 107, 0.04);
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  transition: all 0.1s ease;
  pointer-events: auto;
  cursor: pointer;
}

.atlas-slice-box:hover {
  border-color: #b9f36b;
  background-color: rgba(185, 243, 107, 0.18);
  z-index: 10;
}

.slice-tag {
  font-family: monospace;
  font-size: 8px;
  font-weight: 700;
  color: #b9f36b;
  background-color: rgba(16, 20, 22, 0.85);
  padding: 1px 2px;
  border-radius: 2px;
  line-height: 1;
}

.toggle-overlay-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #98a6a1;
  cursor: pointer;
}

.toggle-overlay-lbl input {
  accent-color: #b9f36b;
}

.atlas-quick-guide {
  padding: 10px 14px;
  background-color: #12181a;
  border-top: 1px solid #283335;
  font-size: 11px;
}

.aqg-title {
  font-weight: 700;
  color: #f1a773;
  margin-bottom: 4px;
}

.aqg-steps {
  margin: 0;
  padding-left: 18px;
  color: #98a6a1;
  line-height: 1.6;
}

.aqg-steps code {
  color: #b9f36b;
  background-color: #171d1f;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid #344143;
}
</style>
