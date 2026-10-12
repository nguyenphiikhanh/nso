<script setup lang="ts">
import type { NsoPart, NsoPartImage } from '../../types/nso'
import type {
  ActionDefinitionItem,
  ActionStepItem,
  CharacterCategory,
} from '../../types/character'

const props = defineProps<{
  studioMode: 'align' | 'animate'
  activeEditCategory: CharacterCategory
  nudgeStep: number
  // Animate Mode props
  currentActionDef?: ActionDefinitionItem
  currentStepCount: number
  activeStepIndex: number
  currentStepData: ActionStepItem | null
  effectiveNeckOverlap: number
  effectiveWaistOverlap: number
  activePartStepOffset: { dx: number; dy: number }
  selectedHeadId: number
  selectedBodyId: number
  selectedLegId: number
  selectedWeaponId: number
  neckOverlap: number
  waistOverlap: number
  // Align Mode props
  editingPart?: NsoPart
  activeCategoryFrameIdx: number
  activeCategoryFrame: NsoPartImage | null
  saving: boolean
  spriteDimensions: Record<number, { w: number; h: number }>
  equippedParts?: {
    head?: NsoPart
    body?: NsoPart
    leg?: NsoPart
    weapon?: NsoPart
  }
}>()

function getEquippedFrameImgId(cat: 'head' | 'body' | 'leg' | 'weapon', frameIdx: number): number | null {
  const p = props.equippedParts?.[cat]
  if (!p || !Array.isArray(p.part)) return null
  const f = p.part[frameIdx]
  if (!f || f.id <= 0) return null
  return f.id
}

const emit = defineEmits<{
  (e: 'set-nudge-step', step: number): void
  (e: 'select-category', cat: CharacterCategory): void
  // Animate Mode emits
  (e: 'change-step-part-frame', cat: CharacterCategory, delta: number): void
  (e: 'nudge-step-joint', joint: 'neck' | 'waist', delta: number): void
  (e: 'reset-step-joint', joint: 'neck' | 'waist'): void
  (e: 'nudge-step-part', cat: CharacterCategory, dx: number, dy: number): void
  (e: 'reset-step-part', cat: CharacterCategory): void
  (e: 'set-step-weapon-angle', deg: number): void
  (e: 'reset-step-weapon-offset'): void
  (e: 'set-step-part-z', cat: CharacterCategory | 'mask', z: number): void
  (e: 'nudge-step-part-z', cat: CharacterCategory | 'mask', delta: number): void
  (e: 'reset-step-part-z', cat: CharacterCategory | 'mask'): void
  (e: 'add-action-step'): void
  (e: 'duplicate-action-step'): void
  (e: 'delete-action-step'): void
  (e: 'reset-current-action'): void
  // Align Mode emits
  (e: 'save-editing-part'): void
  (e: 'nudge', dx: number, dy: number): void
  (e: 'reset-offset'): void
  (e: 'select-frame-idx', idx: number): void
  (e: 'add-frame'): void
  (e: 'duplicate-frame'): void
  (e: 'remove-frame'): void
}>()

function confirmDeleteFrame() {
  if (window.confirm(`⚠️ CẢNH BÁO: Bạn đang xóa Frame #${props.activeCategoryFrameIdx} khỏi Kho của Part #${props.editingPart?.id}. Hành động này sẽ xóa frame gốc khỏi Part. Bạn có chắc chắn không?`)) {
    emit('remove-frame')
  }
}

function getPartZ(cat: CharacterCategory | 'mask'): number {
  if (!props.currentStepData?.zIndices) return 1
  return props.currentStepData.zIndices[cat] ?? 1
}
</script>

<template>
  <aside class="char-inspector">
    <!-- ==================== MODE 1: ACTION STEP INSPECTOR (ANIMATE MODE) ==================== -->
    <div v-if="studioMode === 'animate' && currentStepData && currentActionDef" class="action-inspector-container">
      <!-- Header -->
      <div class="inspector-header">
        <div class="insp-title-row">
          <span class="insp-tag tag-action">{{ currentActionDef.icon }} {{ currentActionDef.label.toUpperCase() }}</span>
          <span class="insp-id">Nhịp #{{ activeStepIndex + 1 }}/{{ currentStepCount }}</span>
        </div>
        <button class="btn-save btn-reset-act" title="Khôi phục động tác này về mặc định" @click="emit('reset-current-action')">
          🔄 Đặt Lại
        </button>
      </div>

      <!-- Step Title Editor -->
      <div class="insp-card step-naming-card">
        <div class="card-label-row">
          <span class="card-title">🏷️ Tên Nhịp Động Tác</span>
          <span class="badge-step-id">ID: {{ currentStepData.id }}</span>
        </div>
        <input
          v-model="currentStepData.name"
          type="text"
          class="input-step-name"
          placeholder="Ví dụ: Giương kiếm, Chém bổ..."
        />
      </div>

      <!-- Block 1: Frame Cho 4 Bộ Phận Ở Nhịp Này -->
      <div class="insp-card parts-frame-card">
        <div class="card-title">🧩 Chọn Frame Cho 4 Bộ Phận Ở Nhịp Này</div>

        <!-- Head Frame -->
        <div class="part-stepper-row">
          <div class="psr-label">
            <span class="psr-icon">🧢</span>
            <span class="psr-name">Đầu #{{ selectedHeadId }}</span>
          </div>
          <div class="psr-thumb-slot" :title="`Sprite Image #${getEquippedFrameImgId('head', currentStepData.headFrame) || 'Trống'}`">
            <img
              v-if="getEquippedFrameImgId('head', currentStepData.headFrame)"
              :src="`/source-media/Small/${getEquippedFrameImgId('head', currentStepData.headFrame)}.png`"
              class="psr-thumb-img"
              loading="lazy"
            />
            <span v-else class="psr-empty-thumb">∅</span>
          </div>
          <div class="stepper-controls">
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'head', -1)">-</button>
            <div class="stepper-display">
              <span class="sd-txt">Frame</span>
              <input
                v-model.number="currentStepData.headFrame"
                type="number"
                min="0"
                class="stepper-input"
              />
            </div>
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'head', 1)">+</button>
          </div>
          <div class="z-stepper-controls" :title="`Z-Index ĐẦU (Mặc định: 1. 0 = Sau lưng, 2 = Phía trước)`">
            <span class="z-lbl">Z:</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'head', -1)">-</button>
            <span class="z-val-display" :class="{ 'custom-z': getPartZ('head') !== 1 }">{{ getPartZ('head') }}</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'head', 1)">+</button>
          </div>
        </div>

        <!-- Body Frame -->
        <div class="part-stepper-row">
          <div class="psr-label">
            <span class="psr-icon">🥋</span>
            <span class="psr-name">Thân #{{ selectedBodyId }}</span>
          </div>
          <div class="psr-thumb-slot" :title="`Sprite Image #${getEquippedFrameImgId('body', currentStepData.bodyFrame) || 'Trống'}`">
            <img
              v-if="getEquippedFrameImgId('body', currentStepData.bodyFrame)"
              :src="`/source-media/Small/${getEquippedFrameImgId('body', currentStepData.bodyFrame)}.png`"
              class="psr-thumb-img"
              loading="lazy"
            />
            <span v-else class="psr-empty-thumb">∅</span>
          </div>
          <div class="stepper-controls">
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'body', -1)">-</button>
            <div class="stepper-display">
              <span class="sd-txt">Frame</span>
              <input
                v-model.number="currentStepData.bodyFrame"
                type="number"
                min="0"
                class="stepper-input"
              />
            </div>
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'body', 1)">+</button>
          </div>
          <div class="z-stepper-controls" :title="`Z-Index THÂN (Mặc định: 1. 0 = Sau lưng, 2 = Phía trước)`">
            <span class="z-lbl">Z:</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'body', -1)">-</button>
            <span class="z-val-display" :class="{ 'custom-z': getPartZ('body') !== 1 }">{{ getPartZ('body') }}</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'body', 1)">+</button>
          </div>
        </div>

        <!-- Leg Frame -->
        <div class="part-stepper-row">
          <div class="psr-label">
            <span class="psr-icon">👖</span>
            <span class="psr-name">Chân #{{ selectedLegId }}</span>
          </div>
          <div class="psr-thumb-slot" :title="`Sprite Image #${getEquippedFrameImgId('leg', currentStepData.legFrame) || 'Trống'}`">
            <img
              v-if="getEquippedFrameImgId('leg', currentStepData.legFrame)"
              :src="`/source-media/Small/${getEquippedFrameImgId('leg', currentStepData.legFrame)}.png`"
              class="psr-thumb-img"
              loading="lazy"
            />
            <span v-else class="psr-empty-thumb">∅</span>
          </div>
          <div class="stepper-controls">
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'leg', -1)">-</button>
            <div class="stepper-display">
              <span class="sd-txt">Frame</span>
              <input
                v-model.number="currentStepData.legFrame"
                type="number"
                min="0"
                class="stepper-input"
              />
            </div>
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'leg', 1)">+</button>
          </div>
          <div class="z-stepper-controls" :title="`Z-Index CHÂN (Mặc định: 1. 0 = Sau lưng, 2 = Phía trước)`">
            <span class="z-lbl">Z:</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'leg', -1)">-</button>
            <span class="z-val-display" :class="{ 'custom-z': getPartZ('leg') !== 1 }">{{ getPartZ('leg') }}</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'leg', 1)">+</button>
          </div>
        </div>

        <!-- Weapon Frame -->
        <div class="part-stepper-row">
          <div class="psr-label">
            <span class="psr-icon">⚔️</span>
            <span class="psr-name">Kiếm #{{ selectedWeaponId }}</span>
          </div>
          <div class="psr-thumb-slot" :title="`Sprite Image #${getEquippedFrameImgId('weapon', currentStepData.weaponFrame) || 'Trống'}`">
            <img
              v-if="getEquippedFrameImgId('weapon', currentStepData.weaponFrame)"
              :src="`/source-media/Small/${getEquippedFrameImgId('weapon', currentStepData.weaponFrame)}.png`"
              class="psr-thumb-img"
              loading="lazy"
            />
            <span v-else class="psr-empty-thumb">∅</span>
          </div>
          <div class="stepper-controls">
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'weapon', -1)">-</button>
            <div class="stepper-display">
              <span class="sd-txt">Frame</span>
              <input
                v-model.number="currentStepData.weaponFrame"
                type="number"
                min="0"
                class="stepper-input"
              />
            </div>
            <button class="btn-step-nudge" @click="emit('change-step-part-frame', 'weapon', 1)">+</button>
          </div>
          <div class="z-stepper-controls" :title="`Z-Index KIẾM (Mặc định: 1. 0 = Sau lưng, 2 = Phía trước)`">
            <span class="z-lbl">Z:</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'weapon', -1)">-</button>
            <span class="z-val-display" :class="{ 'custom-z': getPartZ('weapon') !== 1 }">{{ getPartZ('weapon') }}</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'weapon', 1)">+</button>
          </div>
        </div>

        <!-- Mask / Back Item Frame & Z-Index -->
        <div class="part-stepper-row">
          <div class="psr-label">
            <span class="psr-icon">🎭</span>
            <span class="psr-name">Lưng / Nạ</span>
          </div>
          <div class="psr-thumb-slot" title="Vật phẩm đeo lưng hoặc nón mặt nạ">
            <span class="psr-empty-thumb">🎭</span>
          </div>
          <div class="z-stepper-controls" style="margin-left: auto;" :title="`Z-Index LƯNG / MẶT NẠ (Mặc định: 1. 0 = Sau lưng, 2 = Phía trước)`">
            <span class="z-lbl">Z:</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'mask', -1)">-</button>
            <span class="z-val-display" :class="{ 'custom-z': getPartZ('mask') !== 1 }">{{ getPartZ('mask') }}</span>
            <button class="btn-z-nudge" @click="emit('nudge-step-part-z', 'mask', 1)">+</button>
          </div>
        </div>
      </div>

      <!-- Block 2: 🔗 Khớp Nối Cơ Thể Ở Nhịp Này (Body Joints Tuning) -->
      <div class="insp-card joints-tuning-card">
        <div class="card-label-row">
          <span class="card-title">🔗 Khớp Nối Cơ Thể Ở Nhịp Này</span>
          <span class="badge-step-hint">Nhịp #{{ activeStepIndex + 1 }}</span>
        </div>

        <!-- Khớp Cổ (Neck Joint Overlap) -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">Khớp Cổ: {{ neckOverlap }}px (bù {{ (currentStepData.neckOffset ?? 0) >= 0 ? '+' : '' }}{{ currentStepData.neckOffset ?? 0 }}px)</span>
            <span class="dsi-val">= {{ effectiveNeckOverlap }}px</span>
          </div>
          <div class="dsi-ctrl-row">
            <button class="btn-mini-step" title="Giảm độ sâu khớp cổ nhịp này" @click="emit('nudge-step-joint', 'neck', -1)">-1</button>
            <input
              v-model.number="currentStepData.neckOffset"
              type="range"
              min="-14"
              max="16"
              class="range-slider"
            />
            <button class="btn-mini-step" title="Tăng độ sâu khớp cổ nhịp này" @click="emit('nudge-step-joint', 'neck', 1)">+1</button>
            <button class="btn-mini-step btn-reset-joint" title="Đặt lại khớp cổ về mặc định" @click="emit('reset-step-joint', 'neck')">↺ 0</button>
          </div>
        </div>

        <!-- Khớp Eo (Waist Joint Overlap) -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">Khớp Eo: {{ waistOverlap }}px (bù {{ (currentStepData.waistOffset ?? 0) >= 0 ? '+' : '' }}{{ currentStepData.waistOffset ?? 0 }}px)</span>
            <span class="dsi-val">= {{ effectiveWaistOverlap }}px</span>
          </div>
          <div class="dsi-ctrl-row">
            <button class="btn-mini-step" title="Giảm độ sâu khớp eo nhịp này" @click="emit('nudge-step-joint', 'waist', -1)">-1</button>
            <input
              v-model.number="currentStepData.waistOffset"
              type="range"
              min="-12"
              max="16"
              class="range-slider"
            />
            <button class="btn-mini-step" title="Tăng độ sâu khớp eo nhịp này" @click="emit('nudge-step-joint', 'waist', 1)">+1</button>
            <button class="btn-mini-step btn-reset-joint" title="Đặt lại khớp eo về mặc định" @click="emit('reset-step-joint', 'waist')">↺ 0</button>
          </div>
        </div>
      </div>

      <!-- Block 3: 🎯 Căn Vị Trí Khớp Bộ Phận Ở Nhịp Này (Step Part Offsets & D-Pad) -->
      <div class="insp-card step-part-dpad-card">
        <div class="card-label-row">
          <span class="card-title">🎯 Căn Vị Trí Bộ Phận Ở Nhịp Này</span>
          <div class="step-toggle">
            <button
              class="btn-step"
              :class="{ active: nudgeStep === 1 }"
              @click="emit('set-nudge-step', 1)"
            >
              1px
            </button>
            <button
              class="btn-step"
              :class="{ active: nudgeStep === 5 }"
              @click="emit('set-nudge-step', 5)"
            >
              5px
            </button>
          </div>
        </div>

        <!-- Chọn Bộ Phận Cần Dịch Chuyển -->
        <div class="part-tab-chips">
          <button
            class="pt-chip"
            :class="{ active: activeEditCategory === 'head' }"
            @click="emit('select-category', 'head')"
          >
            🧢 Đầu
          </button>
          <button
            class="pt-chip"
            :class="{ active: activeEditCategory === 'body' }"
            @click="emit('select-category', 'body')"
          >
            🥋 Thân
          </button>
          <button
            class="pt-chip"
            :class="{ active: activeEditCategory === 'leg' }"
            @click="emit('select-category', 'leg')"
          >
            👖 Chân
          </button>
          <button
            class="pt-chip"
            :class="{ active: activeEditCategory === 'weapon' }"
            @click="emit('select-category', 'weapon')"
          >
            ⚔️ Kiếm
          </button>
        </div>

        <!-- D-Pad điều hướng trực quan cho nhịp này -->
        <div class="dpad-container">
          <button class="dpad-btn btn-up" title="Lên trên (Phím ↑)" @click="emit('nudge-step-part', activeEditCategory, 0, -1)">
            ▲
          </button>
          <div class="dpad-mid-row">
            <button class="dpad-btn btn-left" title="Sang trái (Phím Shift+←)" @click="emit('nudge-step-part', activeEditCategory, -1, 0)">
              ◀
            </button>
            <div
              class="dpad-center-badge"
              @click="emit('reset-step-part', activeEditCategory)"
              :title="`Click để đặt lại vị trí ${activeEditCategory.toUpperCase()} ở nhịp này về (0, 0)`"
            >
              <span class="coord-dx">dx: {{ activePartStepOffset.dx }}</span>
              <span class="coord-dy">dy: {{ activePartStepOffset.dy }}</span>
            </div>
            <button class="dpad-btn btn-right" title="Sang phải (Phím Shift+→)" @click="emit('nudge-step-part', activeEditCategory, 1, 0)">
              ▶
            </button>
          </div>
          <button class="dpad-btn btn-down" title="Xuống dưới (Phím ↓)" @click="emit('nudge-step-part', activeEditCategory, 0, 1)">
            ▼
          </button>
        </div>

        <!-- Nhập Tọa Độ Bù Trực Tiếp -->
        <div class="step-part-inputs-grid">
          <div class="nudge-field">
            <label>Bù X (dx):</label>
            <div class="nudge-inputs">
              <button class="btn-mini-step" @click="emit('nudge-step-part', activeEditCategory, -1, 0)">◀</button>
              <input v-if="activeEditCategory === 'head'" v-model.number="currentStepData.headOffset!.dx" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'body'" v-model.number="currentStepData.bodyOffset!.dx" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'leg'" v-model.number="currentStepData.legOffset!.dx" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'weapon'" v-model.number="currentStepData.weaponOffset.dx" type="number" class="mini-num" />
              <button class="btn-mini-step" @click="emit('nudge-step-part', activeEditCategory, 1, 0)">▶</button>
            </div>
          </div>
          <div class="nudge-field">
            <label>Bù Y (dy):</label>
            <div class="nudge-inputs">
              <button class="btn-mini-step" @click="emit('nudge-step-part', activeEditCategory, 0, -1)">▲</button>
              <input v-if="activeEditCategory === 'head'" v-model.number="currentStepData.headOffset!.dy" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'body'" v-model.number="currentStepData.bodyOffset!.dy" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'leg'" v-model.number="currentStepData.legOffset!.dy" type="number" class="mini-num" />
              <input v-else-if="activeEditCategory === 'weapon'" v-model.number="currentStepData.weaponOffset.dy" type="number" class="mini-num" />
              <button class="btn-mini-step" @click="emit('nudge-step-part', activeEditCategory, 0, 1)">▼</button>
            </div>
          </div>
        </div>

        <!-- Thứ Tự Lớp (Z-Index) Cho Bộ Phận Đang Chọn -->
        <div class="part-zindex-bar">
          <div class="pzb-header">
            <span class="pzb-title">🥞 Lớp Hiển Thị (Z-Index) {{ activeEditCategory.toUpperCase() }}:</span>
            <span class="pzb-val-badge" :class="{ active: getPartZ(activeEditCategory) !== 1 }">
              z = {{ getPartZ(activeEditCategory) }}
              <template v-if="getPartZ(activeEditCategory) === 0"> (Sau Lưng)</template>
              <template v-else-if="getPartZ(activeEditCategory) === 1"> (Chuẩn)</template>
              <template v-else-if="getPartZ(activeEditCategory) >= 2"> (Phía Trước)</template>
            </span>
          </div>
          <div class="pzb-actions">
            <button
              class="btn-z-preset"
              :class="{ active: getPartZ(activeEditCategory) === 0 }"
              title="Đặt sau lưng (z=0, nằm sau thân và chân)"
              @click="emit('set-step-part-z', activeEditCategory, 0)"
            >
              0 (Sau lưng)
            </button>
            <button
              class="btn-z-preset"
              :class="{ active: getPartZ(activeEditCategory) === 1 }"
              title="Mặc định chuẩn NSO (z=1)"
              @click="emit('set-step-part-z', activeEditCategory, 1)"
            >
              1 (Chuẩn)
            </button>
            <button
              class="btn-z-preset"
              :class="{ active: getPartZ(activeEditCategory) === 2 }"
              title="Phía trước (z=2, nằm đè lên trước thân và đầu)"
              @click="emit('set-step-part-z', activeEditCategory, 2)"
            >
              2 (Phía trước)
            </button>
            <div class="pzb-stepper">
              <button class="btn-mini-step" title="Giảm 1 lớp" @click="emit('nudge-step-part-z', activeEditCategory, -1)">-</button>
              <button class="btn-mini-step" title="Tăng 1 lớp" @click="emit('nudge-step-part-z', activeEditCategory, 1)">+</button>
              <button class="btn-z-reset" title="Đặt lại về mặc định (1)" @click="emit('reset-step-part-z', activeEditCategory)">↺</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Block 4: Động Lực Học (Motion Dynamics) -->
      <div class="insp-card dynamics-card">
        <div class="card-title">⚡ Động Lực Học Nhịp (Physics / Offset)</div>

        <!-- Lao tới (Lunge X) -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">⏩ Lao Tới / Lùi (Lunge X):</span>
            <span class="dsi-val">{{ currentStepData.lungeX > 0 ? '+' : '' }}{{ currentStepData.lungeX }}px</span>
          </div>
          <div class="dsi-ctrl-row">
            <button class="btn-mini-step" @click="currentStepData.lungeX--">-1</button>
            <input
              v-model.number="currentStepData.lungeX"
              type="range"
              min="-20"
              max="40"
              class="range-slider"
            />
            <button class="btn-mini-step" @click="currentStepData.lungeX++">+1</button>
          </div>
        </div>

        <!-- Bật Nhảy (Jump Y) -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">⬆️ Bật Nhảy / Đỉnh Cao (Jump Y):</span>
            <span class="dsi-val">{{ currentStepData.jumpY }}px</span>
          </div>
          <div class="dsi-ctrl-row">
            <button class="btn-mini-step" @click="currentStepData.jumpY -= 2">-2</button>
            <input
              v-model.number="currentStepData.jumpY"
              type="range"
              min="-80"
              max="20"
              class="range-slider"
            />
            <button class="btn-mini-step" @click="currentStepData.jumpY += 2">+2</button>
          </div>
        </div>

        <!-- Thở (Breath Bob) -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">💨 Nhấp Nhô Thở (Breath Bob):</span>
            <span class="dsi-val">{{ currentStepData.breathBob }}px</span>
          </div>
          <div class="dsi-ctrl-row">
            <button class="btn-mini-step" @click="currentStepData.breathBob--">-1</button>
            <input
              v-model.number="currentStepData.breathBob"
              type="range"
              min="-4"
              max="6"
              class="range-slider"
            />
            <button class="btn-mini-step" @click="currentStepData.breathBob++">+1</button>
          </div>
        </div>
      </div>

      <!-- Block 5: Căn Chỉnh Vũ Khí Cho Nhịp Này (Weapon Tracking) -->
      <div class="insp-card weapon-tracking-card">
        <div class="card-label-row">
          <span class="card-title">🗡️ Căn Vũ Khí Ở Nhịp Này</span>
          <button class="btn-reset-link" @click="emit('reset-step-weapon-offset')">Đặt Lại</button>
        </div>

        <!-- Góc xoay kiếm -->
        <div class="dyn-slider-item">
          <div class="dsi-header">
            <span class="dsi-name">🔄 Góc Xoay Vũ Khí (Rotation):</span>
            <span class="dsi-val">{{ currentStepData.weaponOffset.rot > 0 ? '+' : '' }}{{ currentStepData.weaponOffset.rot }}°</span>
          </div>
          <div class="rot-preset-btns">
            <button
              v-for="deg in [-30, -15, 0, 15, 30, 45]"
              :key="deg"
              class="btn-rot-chip"
              :class="{ active: currentStepData.weaponOffset.rot === deg }"
              @click="emit('set-step-weapon-angle', deg)"
            >
              {{ deg > 0 ? '+' : '' }}{{ deg }}°
            </button>
          </div>
          <div class="dsi-ctrl-row">
            <input
              v-model.number="currentStepData.weaponOffset.rot"
              type="range"
              min="-60"
              max="60"
              class="range-slider"
            />
          </div>
        </div>
      </div>

      <!-- Block 6: Thao Tác Nhanh Nhịp -->
      <div class="insp-card step-ops-footer">
        <div class="card-title">🛠️ Thao Tác Nhịp Này</div>
        <div class="ops-footer-grid">
          <button class="btn-footer-op" @click="emit('add-action-step')">➕ Thêm Sau</button>
          <button class="btn-footer-op" @click="emit('duplicate-action-step')">📋 Nhân Bản</button>
          <button
            class="btn-footer-op btn-footer-del"
            :disabled="currentStepCount <= 1"
            @click="emit('delete-action-step')"
          >
            🗑️ Xóa Nhịp
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== MODE 2: PART ALIGNMENT INSPECTOR (ALIGN MODE) ==================== -->
    <div v-else-if="studioMode === 'align' && editingPart" class="align-inspector-container">
      <!-- Header -->
      <div class="inspector-header">
        <div class="insp-title-row">
          <span class="insp-tag">{{ activeEditCategory.toUpperCase() }}</span>
          <span class="insp-id">Part #{{ editingPart.id }}</span>
          <span v-if="editingPart.isDraft" class="badge-draft">Đã sửa</span>
        </div>
        <button
          class="btn-save"
          :disabled="saving"
          @click="emit('save-editing-part')"
        >
          {{ saving ? 'Đang lưu...' : '💾 Lưu Part' }}
        </button>
      </div>

      <!-- BỘ ĐIỀU KHIỂN D-PAD TRỰC QUAN (NUDGE CONTROLLER) -->
      <div class="nudge-control-card">
        <div class="nudge-card-header">
          <span class="nudge-title">🎯 Căn Chỉnh Khớp Nối (F{{ activeCategoryFrameIdx }})</span>
          <div class="step-toggle">
            <button
              class="btn-step"
              :class="{ active: nudgeStep === 1 }"
              @click="emit('set-nudge-step', 1)"
            >
              1px
            </button>
            <button
              class="btn-step"
              :class="{ active: nudgeStep === 5 }"
              @click="emit('set-nudge-step', 5)"
            >
              5px
            </button>
          </div>
        </div>

        <div class="dpad-container">
          <button class="dpad-btn btn-up" title="Lên trên (Phím ↑)" @click="emit('nudge', 0, -1)">
            ▲
          </button>
          <div class="dpad-mid-row">
            <button class="dpad-btn btn-left" title="Sang trái (Phím ←)" @click="emit('nudge', -1, 0)">
              ◀
            </button>
            <div class="dpad-center-badge" @click="emit('reset-offset')" title="Click để đặt lại (0, 0)">
              <span class="coord-dx">dx: {{ activeCategoryFrame?.dx ?? 0 }}</span>
              <span class="coord-dy">dy: {{ activeCategoryFrame?.dy ?? 0 }}</span>
            </div>
            <button class="dpad-btn btn-right" title="Sang phải (Phím →)" @click="emit('nudge', 1, 0)">
              ▶
            </button>
          </div>
          <button class="dpad-btn btn-down" title="Xuống dưới (Phím ↓)" @click="emit('nudge', 0, 1)">
            ▼
          </button>
        </div>
        <p class="nudge-hint">💡 Phím tắt: Dùng 4 phím mũi tên trên bàn phím để căn pixel nhanh.</p>
      </div>

      <!-- Chi tiết Frame đang chọn -->
      <div class="active-frame-details" v-if="activeCategoryFrame">
        <div class="active-frame-header-row">
          <div class="active-frame-thumb-box">
            <img
              v-if="activeCategoryFrame.id > 0"
              :src="`/source-media/Small/${activeCategoryFrame.id}.png`"
              class="aft-img"
              loading="lazy"
            />
            <span v-else class="fri-empty-badge">∅</span>
          </div>
          <div class="active-frame-meta">
            <div class="detail-row">
              <span class="dt-lbl">Sprite:</span>
              <span class="dt-val">#{{ activeCategoryFrame.id }} ({{ spriteDimensions[activeCategoryFrame.id]?.w ?? '?' }}x{{ spriteDimensions[activeCategoryFrame.id]?.h ?? '?' }}px)</span>
            </div>
            <div class="detail-row">
              <span class="dt-lbl">Độ lệch:</span>
              <span class="dt-val-coord">dx: {{ activeCategoryFrame.dx }}, dy: {{ activeCategoryFrame.dy }}</span>
            </div>
          </div>
        </div>
        <div class="detail-inputs-grid">
          <div class="field-item">
            <label>Image ID:</label>
            <input v-model.number="activeCategoryFrame.id" type="number" class="insp-input" />
          </div>
          <div class="field-item">
            <label>Độ lệch dx:</label>
            <input v-model.number="activeCategoryFrame.dx" type="number" class="insp-input" />
          </div>
          <div class="field-item">
            <label>Độ lệch dy:</label>
            <input v-model.number="activeCategoryFrame.dy" type="number" class="insp-input" />
          </div>
        </div>
      </div>

      <!-- Quản lý danh sách Kho Frames của Part -->
      <div class="frames-manager-card">
        <div class="fmc-header">
          <div class="fmc-title-box">
            <span class="fmc-title">📦 Kho Frames của Part ({{ editingPart.part?.length || 0 }})</span>
            <span class="fmc-sub">Kho ảnh gốc của Part • Click để chọn & căn chỉnh</span>
          </div>
          <div class="fmc-actions">
            <button class="btn-mini-act" title="Thêm frame mới vào kho của Part" @click="emit('add-frame')">➕ Thêm</button>
            <button class="btn-mini-act" title="Nhân bản frame này" @click="emit('duplicate-frame')">📋 Nhân bản</button>
            <button
              class="btn-mini-act btn-danger"
              :disabled="editingPart.part?.length <= 1"
              title="Xóa frame này khỏi kho Part (Có hỏi xác nhận)"
              @click="confirmDeleteFrame"
            >
              🗑️ Xóa
            </button>
          </div>
        </div>

        <div class="frames-vertical-list">
          <div
            v-for="(f, fIdx) in editingPart.part"
            :key="fIdx"
            class="frame-row-item"
            :class="{ active: activeCategoryFrameIdx === fIdx }"
            @click="emit('select-frame-idx', fIdx)"
          >
            <span class="fri-idx">#{{ fIdx }}</span>
            <div class="fri-thumb">
              <img
                v-if="f.id > 0"
                :src="`/source-media/Small/${f.id}.png`"
                class="fri-img"
                loading="lazy"
                @error="($event.target as HTMLElement).style.opacity = '0'"
              />
              <span v-else class="fri-empty-badge" title="Frame trống (Không có sprite)">∅</span>
            </div>
            <span class="fri-id">ID: {{ f.id }}</span>
            <span class="fri-offset">({{ f.dx }}, {{ f.dy }})</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.char-inspector {
  width: 320px;
  min-width: 300px;
  border-left: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
}

.action-inspector-container,
.align-inspector-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.inspector-header {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #344143;
}

.insp-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.insp-tag {
  font-size: 11px;
  font-weight: 700;
  color: #B9F36B;
}

.tag-action {
  color: #B9F36B;
}

.insp-id {
  font-size: 11px;
  color: #E9EFEB;
  font-family: monospace;
}

.badge-draft {
  font-size: 9px;
  background-color: #2D2018;
  color: #F1A773;
  border: 1px solid #5C3D28;
  padding: 1px 4px;
  border-radius: 3px;
}

.btn-save {
  padding: 4px 10px;
  background-color: #202F1C;
  border: 1px solid #3F5E2A;
  color: #B9F36B;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background-color: #293A21;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-reset-act {
  background-color: #20282A;
  color: #98A6A1;
  border: 1px solid #344143;
}

.btn-reset-act:hover {
  border-color: #B9F36B;
  color: #B9F36B;
}

.insp-card {
  padding: 10px 12px;
  border-bottom: 1px solid #283335;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 11px;
  font-weight: 700;
  color: #E9EFEB;
}

.badge-step-id {
  font-size: 9px;
  color: #556260;
  font-family: monospace;
}

.badge-step-hint {
  font-size: 9px;
  color: #B9F36B;
  font-family: monospace;
  background-color: #121A15;
  border: 1px solid #28442B;
  padding: 1px 5px;
  border-radius: 3px;
}

.input-step-name {
  width: 100%;
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  color: #E9EFEB;
  font-size: 11px;
}

.input-step-name:focus {
  border-color: #B9F36B;
  outline: none;
}

.part-stepper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background-color: #12181A;
  border: 1px solid #283335;
  border-radius: 4px;
}

.psr-label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.psr-icon {
  font-size: 12px;
}

.psr-name {
  font-size: 11px;
  font-weight: 600;
  color: #98A6A1;
}

.stepper-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-step-nudge {
  width: 22px;
  height: 22px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  cursor: pointer;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.btn-step-nudge:hover {
  border-color: #B9F36B;
  color: #B9F36B;
}

.stepper-display {
  display: flex;
  align-items: center;
  gap: 3px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  padding: 1px 4px;
}

.sd-txt {
  font-size: 9px;
  color: #556260;
}

.stepper-input {
  width: 28px;
  background: transparent;
  border: none;
  color: #B9F36B;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.stepper-input:focus {
  outline: none;
}

.dyn-slider-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dsi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dsi-name {
  font-size: 11px;
  color: #98A6A1;
  font-weight: 500;
}

.dsi-val {
  font-size: 11px;
  font-family: monospace;
  font-weight: 700;
  color: #B9F36B;
}

.dsi-ctrl-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.range-slider {
  flex: 1;
  accent-color: #B9F36B;
  height: 4px;
}

.btn-mini-step {
  padding: 2px 5px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  font-size: 9px;
  font-family: monospace;
  cursor: pointer;
}

.btn-mini-step:hover {
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-reset-joint {
  color: #98A6A1;
  font-weight: 600;
  padding: 2px 5px;
}

.btn-reset-joint:hover {
  border-color: #F1A773;
  color: #F1A773;
}

.part-tab-chips {
  display: flex;
  gap: 4px;
}

.pt-chip {
  flex: 1;
  padding: 3px 2px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.1s ease;
}

.pt-chip:hover {
  border-color: #556260;
  color: #E9EFEB;
}

.pt-chip.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
  font-weight: 600;
}

.dpad-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 4px 0;
}

.dpad-mid-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dpad-btn {
  width: 38px;
  height: 34px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.dpad-btn:hover {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

.dpad-center-badge {
  width: 80px;
  height: 34px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: monospace;
  font-size: 9px;
  color: #B9F36B;
}

.dpad-center-badge:hover {
  border-color: #F1A773;
}

.step-part-inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 4px;
}

.nudge-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nudge-field label {
  font-size: 10px;
  color: #98A6A1;
}

.nudge-inputs {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mini-num {
  width: 32px;
  padding: 2px 4px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #E9EFEB;
  font-family: monospace;
  font-size: 10px;
  text-align: center;
  border-radius: 3px;
}

.rot-preset-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.btn-rot-chip {
  padding: 2px 6px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 9px;
  font-family: monospace;
  cursor: pointer;
}

.btn-rot-chip.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-reset-link {
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 10px;
  text-decoration: underline;
  cursor: pointer;
}

.btn-reset-link:hover {
  color: #B9F36B;
}

.ops-footer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
}

.btn-footer-op {
  padding: 5px 6px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

.btn-footer-op:hover:not(:disabled) {
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-footer-del:hover:not(:disabled) {
  border-color: #EF7772;
  color: #EF7772;
}

.btn-footer-op:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Align Mode Inspector Classes */
.nudge-control-card {
  padding: 10px 12px;
  border-bottom: 1px solid #344143;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nudge-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nudge-title {
  font-size: 11px;
  font-weight: 700;
  color: #E9EFEB;
}

.step-toggle {
  display: flex;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  overflow: hidden;
}

.btn-step {
  padding: 2px 6px;
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 9px;
  cursor: pointer;
}

.btn-step.active {
  background-color: #293A21;
  color: #B9F36B;
  font-weight: 600;
}

.nudge-hint {
  font-size: 10px;
  color: #98A6A1;
  text-align: center;
  margin: 0;
  line-height: 1.3;
}

.active-frame-details {
  padding: 10px 12px;
  border-bottom: 1px solid #344143;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.dt-lbl {
  color: #98A6A1;
}

.dt-val {
  color: #E9EFEB;
  font-family: monospace;
}

.detail-inputs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-item label {
  font-size: 9px;
  color: #98A6A1;
}

.insp-input {
  width: 100%;
  padding: 4px 6px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  color: #E9EFEB;
  font-size: 10px;
  font-family: monospace;
}

.frames-manager-card {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.fmc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fmc-title {
  font-size: 11px;
  font-weight: 700;
  color: #E9EFEB;
}

.fmc-actions {
  display: flex;
  gap: 3px;
}

.btn-mini-act {
  padding: 2px 5px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  font-size: 9px;
  cursor: pointer;
}

.btn-mini-act.btn-danger:hover:not(:disabled) {
  border-color: #EF7772;
  color: #EF7772;
}

.btn-mini-act:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.frames-vertical-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
  max-height: 240px;
}

.frame-row-item {
  display: flex;
  align-items: center;
  padding: 3px 6px;
  background-color: #12181A;
  border: 1px solid #283335;
  border-radius: 3px;
  cursor: pointer;
  gap: 8px;
}

.frame-row-item.active {
  border-color: #B9F36B;
  background-color: #1C271E;
}

.fri-idx {
  font-family: monospace;
  font-size: 9px;
  color: #B9F36B;
  font-weight: 700;
  width: 20px;
}

.fri-thumb {
  width: 24px;
  height: 24px;
  background-color: #101416;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fri-img {
  image-rendering: pixelated;
  max-width: 100%;
  max-height: 100%;
}

.fri-id {
  font-family: monospace;
  font-size: 9px;
  color: #98A6A1;
}

.fri-offset {
  margin-left: auto;
  font-family: monospace;
  font-size: 9px;
  color: #F1A773;
}

.fri-empty-badge {
  font-size: 11px;
  color: #556260;
  font-family: monospace;
}

.psr-thumb-slot {
  width: 28px;
  height: 28px;
  background-color: #101416;
  border: 1px solid #283335;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.psr-thumb-img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

.psr-empty-thumb {
  font-size: 11px;
  color: #556260;
  font-family: monospace;
}

.active-frame-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 6px;
  background-color: #12181A;
  border: 1px solid #283335;
  border-radius: 4px;
}

.active-frame-thumb-box {
  width: 38px;
  height: 38px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.aft-img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

.active-frame-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.dt-val-coord {
  font-family: monospace;
  font-size: 11px;
  color: #F1A773;
}

/* Z-Index Stepper in Block 1 */
.z-stepper-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  padding: 1px 3px;
}

.z-lbl {
  font-size: 9px;
  color: #98A6A1;
  font-weight: 600;
  margin-right: 1px;
}

.btn-z-nudge {
  width: 16px;
  height: 18px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-z-nudge:hover {
  border-color: #B9F36B;
  color: #B9F36B;
}

.z-val-display {
  min-width: 14px;
  text-align: center;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  color: #E9EFEB;
}

.z-val-display.custom-z {
  color: #B9F36B;
}

/* Z-Index Card in Block 3 */
.part-zindex-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background-color: #101416;
  border: 1px solid #283335;
  border-radius: 4px;
  padding: 6px 8px;
  margin-top: 6px;
}

.pzb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pzb-title {
  font-size: 10px;
  font-weight: 600;
  color: #98A6A1;
}

.pzb-val-badge {
  font-size: 10px;
  font-family: monospace;
  color: #E9EFEB;
  background-color: #1A2124;
  border: 1px solid #344143;
  padding: 1px 6px;
  border-radius: 3px;
}

.pzb-val-badge.active {
  color: #18210F;
  background-color: #B9F36B;
  border-color: #B9F36B;
  font-weight: 700;
}

.pzb-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.btn-z-preset {
  flex: 1;
  min-width: 60px;
  padding: 3px 6px;
  background-color: #171D1F;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-z-preset:hover {
  background-color: #20282A;
  color: #E9EFEB;
  border-color: #98A6A1;
}

.btn-z-preset.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
  font-weight: 700;
}

.pzb-stepper {
  display: flex;
  align-items: center;
  gap: 3px;
}

.btn-z-reset {
  padding: 2px 5px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.btn-z-reset:hover {
  border-color: #EF7772;
  color: #EF7772;
}
</style>
