<script setup lang="ts">
import { ref } from 'vue'
import type { NsoPart } from '../../types/nso'
import type { ActionDefinitionItem } from '../../types/character'

defineProps<{
  studioMode: 'align' | 'animate'
  editingPart?: NsoPart
  activeCategoryFrameIdx: number
  currentActionDef?: ActionDefinitionItem
  currentStepCount: number
  activeStepIndex: number
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select-frame-idx', idx: number): void
  (e: 'add-frame'): void
  (e: 'duplicate-frame'): void
  (e: 'remove-frame'): void
  (e: 'set-step', idx: number): void
  (e: 'toggle-play'): void
  (e: 'pause'): void
  (e: 'first-step'): void
  (e: 'prev-step'): void
  (e: 'next-step'): void
  (e: 'last-step'): void
  (e: 'add-action-step'): void
  (e: 'duplicate-action-step'): void
  (e: 'delete-action-step'): void
  (e: 'reset-current-action'): void
  (e: 'reorder-step', fromIndex: number, toIndex: number): void
}>()

// HTML5 Drag and Drop for Reordering Action Steps
const draggedStepIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const dragOverConnectorIdx = ref<number | null>(null)
let dragSourceIndex: number | null = null

function onDragStart(idx: number, e: DragEvent) {
  emit('pause')
  dragSourceIndex = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
  // Delay setting draggedStepIndex ref slightly so browser captures sharp preview before style change
  setTimeout(() => {
    draggedStepIndex.value = idx
  }, 0)
}

function hasCustomZIndex(st: any): boolean {
  const z = st?.zIndices
  if (!z) return false
  return (
    (z.head !== undefined && z.head !== 1) ||
    (z.body !== undefined && z.body !== 1) ||
    (z.leg !== undefined && z.leg !== 1) ||
    (z.weapon !== undefined && z.weapon !== 1) ||
    (z.mask !== undefined && z.mask !== 1)
  )
}

function formatZSummary(st: any): string {
  const z = st?.zIndices
  if (!z) return ''
  const parts: string[] = []
  if (z.weapon !== undefined && z.weapon !== 1) parts.push(`K:${z.weapon}`)
  if (z.mask !== undefined && z.mask !== 1) parts.push(`L:${z.mask}`)
  if (z.body !== undefined && z.body !== 1) parts.push(`T:${z.body}`)
  if (z.head !== undefined && z.head !== 1) parts.push(`Đ:${z.head}`)
  if (z.leg !== undefined && z.leg !== 1) parts.push(`C:${z.leg}`)
  return parts.join(' ')
}

function formatZTooltip(st: any): string {
  const z = st?.zIndices
  if (!z) return 'Lớp mặc định (1)'
  return `Thứ tự lớp Z-Index: Đầu=${z.head ?? 1}, Thân=${z.body ?? 1}, Chân=${z.leg ?? 1}, Kiếm=${z.weapon ?? 1}, Lưng/Nạ=${z.mask ?? 1}`
}

function onDragOver(idx: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = idx
  dragOverConnectorIdx.value = null
}

function onDragLeave(idx: number, e: DragEvent) {
  if (dragOverIndex.value === idx) {
    const cur = e.currentTarget as HTMLElement | null
    const rel = e.relatedTarget as HTMLElement | null
    if (!cur || !rel || !cur.contains(rel)) {
      dragOverIndex.value = null
    }
  }
}

function onDrop(toIdx: number, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  let fromIdx = draggedStepIndex.value ?? dragSourceIndex
  if (fromIdx === null && e.dataTransfer) {
    const raw = e.dataTransfer.getData('text/plain')
    if (raw !== '') {
      const p = parseInt(raw, 10)
      if (!isNaN(p)) fromIdx = p
    }
  }
  if (fromIdx !== null && fromIdx !== toIdx) {
    emit('reorder-step', fromIdx, toIdx)
  }
  dragOverIndex.value = null
  dragOverConnectorIdx.value = null
  setTimeout(() => {
    draggedStepIndex.value = null
    dragSourceIndex = null
  }, 50)
}

function onConnectorDragOver(idx: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverConnectorIdx.value = idx
  dragOverIndex.value = null
}

function onConnectorDragLeave(idx: number) {
  if (dragOverConnectorIdx.value === idx) {
    dragOverConnectorIdx.value = null
  }
}

function onConnectorDrop(connectorIdx: number, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  let fromIdx = draggedStepIndex.value ?? dragSourceIndex
  if (fromIdx === null && e.dataTransfer) {
    const raw = e.dataTransfer.getData('text/plain')
    if (raw !== '') {
      const p = parseInt(raw, 10)
      if (!isNaN(p)) fromIdx = p
    }
  }
  if (fromIdx !== null) {
    const targetIdx = fromIdx <= connectorIdx ? connectorIdx : connectorIdx + 1
    if (fromIdx !== targetIdx) {
      emit('reorder-step', fromIdx, targetIdx)
    }
  }
  dragOverIndex.value = null
  dragOverConnectorIdx.value = null
  setTimeout(() => {
    draggedStepIndex.value = null
    dragSourceIndex = null
  }, 50)
}

function onDragEnd() {
  dragOverIndex.value = null
  dragOverConnectorIdx.value = null
  setTimeout(() => {
    draggedStepIndex.value = null
    dragSourceIndex = null
  }, 50)
}
</script>

<template>
  <!-- 1. Bottom Frame Filmstrip (Khi ở mode Align) -->
  <div v-if="studioMode === 'align' && editingPart" class="bottom-filmstrip">
    <div class="filmstrip-label">
      <span>Frames ({{ editingPart.part?.length || 0 }}):</span>
    </div>
    <div class="filmstrip-scroll">
      <div
        v-for="(f, fIdx) in editingPart.part"
        :key="fIdx"
        class="frame-chip"
        :class="{ active: activeCategoryFrameIdx === fIdx }"
        @click="emit('select-frame-idx', fIdx)"
      >
        <span class="chip-idx">F{{ fIdx }}</span>
        <span class="chip-img-id">#{{ f.id }}</span>
        <span v-if="f.dx !== 0 || f.dy !== 0" class="chip-offset">
          {{ f.dx }},{{ f.dy }}
        </span>
      </div>
    </div>
    <div class="filmstrip-actions">
      <button class="btn-film" title="Thêm frame mới cho Part" @click="emit('add-frame')">➕ Thêm</button>
      <button class="btn-film" title="Nhân bản frame này" @click="emit('duplicate-frame')">📋 Nhân bản</button>
    </div>
  </div>

  <!-- 2. Bottom Visual Timeline Bar (Khi ở mode Animate) -->
  <div v-else-if="studioMode === 'animate' && currentActionDef" class="timeline-visual-bar">
    <!-- Tier 1: Action Playback & Track Overview Dock -->
    <div class="timeline-playback-dock">
      <div class="action-info-group">
        <span class="action-icon-badge">{{ currentActionDef.icon }}</span>
        <div class="action-meta">
          <span class="action-name-txt">{{ currentActionDef.label }}</span>
          <span class="action-steps-cnt">{{ currentStepCount }} nhịp diễn</span>
        </div>
        <span class="action-loop-badge" title="Tự động lặp lại tuần hoàn">🔁 Loop</span>
      </div>

      <div class="playback-transport-controls">
        <button class="btn-transport" title="Về nhịp đầu (Home)" @click="emit('first-step')">⏮</button>
        <button class="btn-transport" title="Lùi 1 nhịp (←)" @click="emit('prev-step')">◀</button>
        <button
          class="btn-transport btn-transport-play"
          :class="{ active: isPlaying }"
          :title="isPlaying ? 'Tạm dừng (Space)' : 'Phát liên tục (Space)'"
          @click="emit('toggle-play')"
        >
          {{ isPlaying ? '⏸ Tạm Dừng' : '▶ Phát' }}
        </button>
        <button class="btn-transport" title="Tiến 1 nhịp (→)" @click="emit('next-step')">▶</button>
        <button class="btn-transport" title="Đến nhịp cuối (End)" @click="emit('last-step')">⏭</button>
        <div class="step-counter-pill">
          <span class="cur-step">{{ activeStepIndex + 1 }}</span>
          <span class="sep-step">/</span>
          <span class="total-step">{{ currentStepCount }}</span>
        </div>
      </div>

      <div class="step-ops-group">
        <button
          class="btn-step-action btn-move-step"
          :disabled="activeStepIndex <= 0"
          title="Dịch nhịp đang chọn sang trái 1 bước (Alt+←)"
          @click="emit('reorder-step', activeStepIndex, activeStepIndex - 1)"
        >
          ◀ Dịch Trái
        </button>
        <button
          class="btn-step-action btn-move-step"
          :disabled="activeStepIndex >= currentStepCount - 1"
          title="Dịch nhịp đang chọn sang phải 1 bước (Alt+→)"
          @click="emit('reorder-step', activeStepIndex, activeStepIndex + 1)"
        >
          ▶ Dịch Phải
        </button>
        <button class="btn-step-action btn-add-step" title="Thêm 1 nhịp mới sau nhịp này" @click="emit('add-action-step')">
          ➕ Thêm Nhịp
        </button>
        <button class="btn-step-action" title="Nhân bản nhịp đang chọn" @click="emit('duplicate-action-step')">
          📋 Nhân Bản
        </button>
        <button
          class="btn-step-action btn-del-step"
          :disabled="currentStepCount <= 1"
          title="Xóa nhịp đang chọn"
          @click="emit('delete-action-step')"
        >
          🗑️ Xóa
        </button>
        <button class="btn-step-action btn-reset-step" title="Khôi phục động tác này về cài đặt gốc" @click="emit('reset-current-action')">
          🔄 Đặt Lại Gốc
        </button>
      </div>
    </div>

    <!-- Tier 2: Dải Thẻ Nhịp Tuần Tự (Interactive Visual Step Cards Flow) -->
    <div class="timeline-step-track-scroll">
      <div
        class="timeline-track-inner"
        :class="{ is_dragging_active: draggedStepIndex !== null }"
      >
        <template v-for="(st, idx) in currentActionDef.steps" :key="st.id || idx">
          <div
            class="step-visual-card"
            :class="{
              active: activeStepIndex === idx,
              is_running: isPlaying && activeStepIndex === idx,
              is_dragging: draggedStepIndex === idx,
              drag_over_target: dragOverIndex === idx && draggedStepIndex !== idx,
            }"
            draggable="true"
            @dragstart="onDragStart(idx, $event)"
            @dragover="onDragOver(idx, $event)"
            @dragleave="onDragLeave(idx, $event)"
            @drop="onDrop(idx, $event)"
            @dragend="onDragEnd"
            @click="emit('set-step', idx)"
          >
            <div class="svc-header">
              <span class="svc-drag-handle" title="Kéo thả thẻ này để đổi thứ tự nhịp">⋮⋮</span>
              <div class="svc-index-badge">
                <span class="idx-prefix">#</span>
                <span class="idx-digit">{{ idx + 1 }}</span>
              </div>
              <span class="svc-name" :title="st.name">{{ st.name }}</span>
              <div class="svc-shift-actions" @click.stop>
                <button
                  type="button"
                  class="btn-shift-step"
                  :disabled="idx === 0"
                  title="Dịch nhịp này sang trái"
                  @click.stop="emit('reorder-step', idx, idx - 1)"
                >
                  ◀
                </button>
                <button
                  type="button"
                  class="btn-shift-step"
                  :disabled="idx === currentActionDef.steps.length - 1"
                  title="Dịch nhịp này sang phải"
                  @click.stop="emit('reorder-step', idx, idx + 1)"
                >
                  ▶
                </button>
              </div>
              <span v-if="activeStepIndex === idx" class="svc-active-beacon" title="Đang ở nhịp này" />
            </div>

            <div class="svc-parts-grid">
              <div class="svc-part-item part-head" title="Frame Đầu">
                <span class="spi-icon">🧢</span>
                <span class="spi-txt">Đ:<b>{{ st.headFrame }}</b></span>
              </div>
              <div class="svc-part-item part-body" title="Frame Thân">
                <span class="spi-icon">🥋</span>
                <span class="spi-txt">T:<b>{{ st.bodyFrame }}</b></span>
              </div>
              <div class="svc-part-item part-leg" title="Frame Chân">
                <span class="spi-icon">👖</span>
                <span class="spi-txt">C:<b>{{ st.legFrame }}</b></span>
              </div>
              <div class="svc-part-item part-weapon" title="Frame Kiếm">
                <span class="spi-icon">⚔️</span>
                <span class="spi-txt">K:<b>{{ st.weaponFrame }}</b></span>
              </div>
            </div>

            <div class="svc-motion-row">
              <span v-if="st.neckOffset" class="svc-pill pill-joint" :title="`Bù khớp cổ: ${st.neckOffset > 0 ? '+' : ''}${st.neckOffset}px`">
                🔗 Cổ:{{ st.neckOffset > 0 ? '+' : '' }}{{ st.neckOffset }}
              </span>
              <span v-if="st.waistOffset" class="svc-pill pill-joint" :title="`Bù khớp eo: ${st.waistOffset > 0 ? '+' : ''}${st.waistOffset}px`">
                🔗 Eo:{{ st.waistOffset > 0 ? '+' : '' }}{{ st.waistOffset }}
              </span>
              <span v-if="st.lungeX !== 0" class="svc-pill pill-lunge" title="Độ lao tới/lùi">
                ⏩ {{ st.lungeX > 0 ? '+' : '' }}{{ st.lungeX }}px
              </span>
              <span v-if="st.jumpY !== 0" class="svc-pill pill-jump" title="Độ cao bật nhảy">
                ⬆️ {{ st.jumpY }}px
              </span>
              <span v-if="st.weaponOffset.rot !== 0" class="svc-pill pill-rot" title="Góc xoay kiếm">
                🔄 {{ st.weaponOffset.rot > 0 ? '+' : '' }}{{ st.weaponOffset.rot }}°
              </span>
              <span v-if="st.breathBob !== 0" class="svc-pill pill-bob" title="Nhấp nhô thở">
                💨 {{ st.breathBob > 0 ? '+' : '' }}{{ st.breathBob }}px
              </span>
              <span v-if="hasCustomZIndex(st)" class="svc-pill pill-zlayer" :title="formatZTooltip(st)">
                🥞 {{ formatZSummary(st) }}
              </span>
              <span
                v-if="!st.neckOffset && !st.waistOffset && st.lungeX === 0 && st.jumpY === 0 && st.weaponOffset.rot === 0 && st.breathBob === 0 && !hasCustomZIndex(st)"
                class="svc-pill pill-static"
              >
                📍 Tĩnh
              </span>
            </div>
          </div>

          <div
            v-if="idx < currentActionDef.steps.length - 1"
            class="step-flow-connector"
            :class="{ drag_over_connector: dragOverConnectorIdx === idx }"
            :title="draggedStepIndex !== null ? 'Thả vào đây để chèn vào vị trí này' : 'Tiến trình sang nhịp tiếp theo'"
            @dragover="onConnectorDragOver(idx, $event)"
            @dragleave="onConnectorDragLeave(idx)"
            @drop="onConnectorDrop(idx, $event)"
          >
            <span class="flow-arrow">{{ dragOverConnectorIdx === idx ? '📥' : '→' }}</span>
          </div>
          <div
            v-else
            class="step-flow-connector step-loop-connector"
            :class="{ drag_over_connector: dragOverConnectorIdx === idx }"
            :title="draggedStepIndex !== null ? 'Thả vào đây để đưa về cuối' : 'Vòng lặp tuần hoàn về nhịp đầu'"
            @dragover="onConnectorDragOver(idx, $event)"
            @dragleave="onConnectorDragLeave(idx)"
            @drop="onConnectorDrop(idx, $event)"
          >
            <span class="loop-icon">{{ dragOverConnectorIdx === idx ? '📥' : '🔁' }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Bottom Frame Filmstrip (Align Mode) */
.bottom-filmstrip {
  height: 52px;
  background-color: #171D1F;
  border-top: 1px solid #344143;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 12px;
}

.filmstrip-label {
  font-size: 11px;
  font-weight: 600;
  color: #98A6A1;
  white-space: nowrap;
}

.filmstrip-scroll {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 0;
}

.frame-chip {
  padding: 4px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.frame-chip.active {
  background-color: #293A21;
  border-color: #B9F36B;
}

.chip-idx {
  font-weight: 700;
  font-size: 10px;
  color: #B9F36B;
}

.chip-img-id {
  font-family: monospace;
  font-size: 10px;
  color: #98A6A1;
}

.chip-offset {
  font-size: 9px;
  color: #F1A773;
}

.filmstrip-actions {
  display: flex;
  gap: 4px;
}

.btn-film {
  padding: 4px 8px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
}

.btn-film:hover:not(:disabled) {
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-film.btn-danger:hover:not(:disabled) {
  border-color: #EF7772;
  color: #EF7772;
}

.btn-film:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==================== TIMELINE VISUAL BAR (ANIMATE MODE) ==================== */
.timeline-visual-bar {
  background-color: #141A1C;
  border-top: 1px solid #344143;
  display: flex;
  flex-direction: column;
}

.timeline-playback-dock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: #171E20;
  border-bottom: 1px solid #283335;
  gap: 12px;
}

.action-info-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-icon-badge {
  font-size: 15px;
}

.action-meta {
  display: flex;
  flex-direction: column;
}

.action-name-txt {
  font-size: 11px;
  font-weight: 700;
  color: #B9F36B;
}

.action-steps-cnt {
  font-size: 9px;
  color: #98A6A1;
}

.action-loop-badge {
  font-size: 9px;
  color: #98A6A1;
  background-color: #101416;
  border: 1px solid #344143;
  padding: 1px 4px;
  border-radius: 3px;
}

.playback-transport-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-transport {
  padding: 4px 8px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-transport:hover {
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-transport-play {
  background-color: #202F1C;
  border-color: #3F5E2A;
  color: #B9F36B;
  font-weight: 600;
}

.step-counter-pill {
  display: flex;
  align-items: center;
  padding: 2px 6px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  font-family: monospace;
  font-size: 10px;
}

.cur-step {
  color: #B9F36B;
  font-weight: 700;
}

.sep-step {
  color: #556260;
  margin: 0 2px;
}

.total-step {
  color: #98A6A1;
}

.step-ops-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-step-action {
  padding: 3px 6px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.btn-step-action:hover:not(:disabled) {
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-del-step:hover:not(:disabled) {
  border-color: #EF7772;
  color: #EF7772;
}

.btn-step-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.timeline-step-track-scroll {
  padding: 8px 12px;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: #121719;
}

.timeline-track-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
}

.step-visual-card {
  width: 175px;
  min-width: 175px;
  background-color: #171E20;
  border: 1px solid #344143;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  user-select: none;
}

.step-visual-card:active {
  cursor: grabbing;
}

.step-visual-card.is_dragging {
  opacity: 0.4;
  border-style: dashed;
  border-color: #B9F36B;
  transform: scale(0.96);
  cursor: grabbing;
}

.step-visual-card.drag_over_target {
  border-color: #B9F36B;
  box-shadow: 0 0 14px rgba(185, 243, 107, 0.45);
  transform: translateY(-4px) scale(1.02);
}

.step-visual-card:hover:not(.is_dragging) {
  border-color: #556260;
  background-color: #1C2427;
}

.step-visual-card.active {
  border-color: #B9F36B;
  background-color: #1B261D;
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.25);
}

.svc-header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.svc-drag-handle {
  cursor: grab;
  font-size: 13px;
  line-height: 1;
  color: #6D7F84;
  user-select: none;
  letter-spacing: -2px;
  margin-right: 1px;
  transition: color 0.15s ease;
}

.svc-drag-handle:hover {
  color: #B9F36B;
}

.svc-drag-handle:active {
  cursor: grabbing;
}

.svc-index-badge {
  display: inline-flex;
  align-items: baseline;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  color: #E9EFEB;
}

.step-visual-card.active .svc-index-badge {
  border-color: #B9F36B;
  color: #B9F36B;
}

.idx-prefix {
  font-size: 8px;
  color: #98A6A1;
}

.svc-name {
  font-size: 11px;
  font-weight: 600;
  color: #E9EFEB;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.step-visual-card.active .svc-name {
  color: #B9F36B;
}

.svc-active-beacon {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #B9F36B;
  box-shadow: 0 0 6px #B9F36B;
  animation: beacon-pulse 1.2s infinite ease-in-out;
}

@keyframes beacon-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

.svc-parts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  background-color: #101416;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #283335;
}

.svc-part-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: #98A6A1;
}

.spi-txt b {
  color: #E9EFEB;
  font-family: monospace;
}

.step-visual-card.active .spi-txt b {
  color: #B9F36B;
}

.svc-motion-row {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
  min-height: 16px;
}

.svc-pill {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.pill-lunge {
  background-color: #2D2018;
  color: #F1A773;
  border: 1px solid #5C3D28;
}

.pill-jump {
  background-color: #162B28;
  color: #79E2D2;
  border: 1px solid #2B5750;
}

.pill-rot {
  background-color: #2A2C18;
  color: #E1E86E;
  border: 1px solid #555A2A;
}

.pill-bob {
  background-color: #20282A;
  color: #A3B5B0;
  border: 1px solid #344143;
}

.pill-joint {
  background-color: #2D2714;
  color: #F3CA6B;
  border: 1px solid #5A4A1C;
}

.pill-zlayer {
  background-color: #162419;
  color: #B9F36B;
  border: 1px solid #2F4D3C;
}

.pill-static {
  background-color: transparent;
  color: #556260;
  font-weight: 500;
}

.step-flow-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  height: 60px;
  border-radius: 4px;
  user-select: none;
  transition: all 0.15s ease;
}

.step-flow-connector.drag_over_connector {
  background-color: rgba(185, 243, 107, 0.2);
  border: 1px dashed #B9F36B;
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.4);
  transform: scale(1.15);
}

.timeline-track-inner.is_dragging_active .step-visual-card * {
  pointer-events: none;
}

.timeline-track-inner.is_dragging_active .step-flow-connector * {
  pointer-events: none;
}

.svc-shift-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.btn-shift-step {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #101416;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 8px;
  padding: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-shift-step:hover:not(:disabled) {
  border-color: #B9F36B;
  color: #B9F36B;
  background-color: #202F1C;
}

.btn-shift-step:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  border-color: transparent;
}

.btn-move-step:hover:not(:disabled) {
  border-color: #B9F36B;
  color: #B9F36B;
  background-color: #202F1C;
}

.flow-arrow {
  font-size: 14px;
  color: #495B5E;
  font-weight: 700;
}

.loop-icon {
  font-size: 13px;
  color: #B9F36B;
  opacity: 0.7;
}
</style>
