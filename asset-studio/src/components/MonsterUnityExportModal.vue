<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { NsoMonsterDetail } from '../types/nso'

const props = defineProps<{
  mob: NsoMonsterDetail
  isComposite: boolean
  fps: number
  activeSequence: number[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'fps-updated', fps: number): void
}>()

// Tabs
const activeTab = ref<'preview' | 'json'>('preview')

// Action selection for boss mobs
const selectedActionKey = ref<string>('move')
const exportFps = ref<number>(props.fps || 8)
const exportScale = ref<number>(1) // 1x, 2x, 4x
const padding = ref<number>(4)
const showGrid = ref<boolean>(true)
const previewZoom = ref<number>(1.5)
const isGenerating = ref<boolean>(false)
const copiedToast = ref<boolean>(false)

// Canvas references
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const sheetDimensions = ref<{ width: number; height: number; cellW: number; cellH: number; count: number }>({
  width: 0,
  height: 0,
  cellW: 0,
  cellH: 0,
  count: 0,
})

// Metadata output
const exportedFramesMeta = ref<any[]>([])

// Determine available actions for the monster
const availableActions = computed(() => {
  if (!props.isComposite) {
    return [
      { key: 'default', label: `Mặc định (${props.mob.n_img} frames)`, sequence: Array.from({ length: props.mob.n_img }, (_, i) => i) },
    ]
  }

  const actions: Array<{ key: string; label: string; sequence: number[] }> = []

  if (Array.isArray(props.mob.move) && props.mob.move.length > 0) {
    actions.push({ key: 'move', label: `Di chuyển (${props.mob.move.length} nhịp)`, sequence: props.mob.move })
  }

  if (Array.isArray(props.mob.attack)) {
    props.mob.attack.forEach((atkSeq, idx) => {
      if (Array.isArray(atkSeq) && atkSeq.length > 0) {
        actions.push({ key: `attack_${idx}`, label: `Tấn công #${idx + 1} (${atkSeq.length} nhịp)`, sequence: atkSeq })
      }
    })
  }

  // Stand/Idle frame 0
  actions.push({ key: 'stand', label: 'Đứng yên (Frame #0)', sequence: [0] })

  // All skeleton frames
  if (Array.isArray(props.mob.frames) && props.mob.frames.length > 0) {
    actions.push({
      key: 'all_frames',
      label: `Toàn bộ khung (${props.mob.frames.length} frames)`,
      sequence: Array.from({ length: props.mob.frames.length }, (_, i) => i),
    })
  }

  return actions
})

const currentSequence = computed<number[]>(() => {
  const found = availableActions.value.find((a) => a.key === selectedActionKey.value)
  if (found) return found.sequence
  return props.activeSequence.length > 0 ? props.activeSequence : [0]
})

const unityExportJson = computed(() => {
  const actName = availableActions.value.find((a) => a.key === selectedActionKey.value)?.label || selectedActionKey.value
  return {
    meta: {
      generator: 'Game Asset Studio - NSO Monster Unity Exporter',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      mobId: props.mob.id,
      mobName: props.mob.name,
      level: props.mob.level,
      type: props.isComposite ? 'boss_composite' : 'regular_sequential',
      action: selectedActionKey.value,
      actionLabel: actName,
      fps: exportFps.value,
      frameDurationSec: 1 / exportFps.value,
      scale: exportScale.value,
      totalFrames: sheetDimensions.value.count,
      sheetWidth: sheetDimensions.value.width,
      sheetHeight: sheetDimensions.value.height,
      cellWidth: sheetDimensions.value.cellW,
      cellHeight: sheetDimensions.value.cellH,
      pivot: { x: 0.5, y: 0.0, description: 'Chân quái vật (Bottom Center)' },
    },
    frames: exportedFramesMeta.value,
  }
})

const jsonString = computed(() => JSON.stringify(unityExportJson.value, null, 2))

// Render / Bake Spritesheet on canvas
async function generateSpritesheet() {
  if (!previewCanvas.value || !props.mob) return
  isGenerating.value = true

  const canvas = previewCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    isGenerating.value = false
    return
  }

  ctx.imageSmoothingEnabled = false

  try {
    const scale = exportScale.value
    const pad = padding.value
    const seq = currentSequence.value

    if (!props.isComposite) {
      // ==================== QUÁI THƯỜNG (Frame-by-frame) ====================
      // Load all frames in parallel
      const frameIndices = seq
      const imgPromises = frameIndices.map((fIdx) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`Không thể nạp frame #${fIdx} của quái ${props.mob.id}`))
          img.src = `/source-media/Mob/${props.mob.id}_${fIdx}.png`
        })
      })

      const images = await Promise.all(imgPromises)

      let maxW = 32
      let maxH = 32
      for (const img of images) {
        if (img.width > maxW) maxW = img.width
        if (img.height > maxH) maxH = img.height
      }

      const cellW = (maxW + pad * 2) * scale
      const cellH = (maxH + pad * 2) * scale
      const totalFrames = images.length
      const sheetW = cellW * totalFrames
      const sheetH = cellH

      canvas.width = sheetW
      canvas.height = sheetH
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, sheetW, sheetH)

      const meta: any[] = []

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        const cellX = i * cellW
        const cellY = 0

        // Bottom center alignment so feet stay planted
        const targetW = img.width * scale
        const targetH = img.height * scale
        const drawX = cellX + Math.round((cellW - targetW) / 2)
        const drawY = cellY + (cellH - targetH - pad * scale)

        ctx.drawImage(img, drawX, drawY, targetW, targetH)

        meta.push({
          index: i,
          frameId: frameIndices[i],
          filename: `mob_${props.mob.id}_${frameIndices[i]}`,
          rect: {
            x: cellX,
            y: cellY,
            width: cellW,
            height: cellH,
          },
          spriteRect: {
            x: drawX,
            y: drawY,
            width: targetW,
            height: targetH,
          },
          pivot: { x: 0.5, y: 0.0 },
          duration: 1 / exportFps.value,
        })
      }

      sheetDimensions.value = {
        width: sheetW,
        height: sheetH,
        cellW,
        cellH,
        count: totalFrames,
      }
      exportedFramesMeta.value = meta
    } else {
      // ==================== QUÁI BOSS (Composite Ghép Mảnh) ====================
      const mobImg = new Image()
      mobImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        mobImg.onload = () => resolve()
        mobImg.onerror = () => reject(new Error(`Không thể nạp ảnh sheet của quái ${props.mob.id}`))
        mobImg.src = `/source-media/Mob/${props.mob.id}_0.png`
      })

      const frames = props.mob.frames || []
      const sprites = props.mob.sprites || []

      // Calculate global bounding box across all selected sequence frames
      let minX = 0
      let minY = 0
      let maxX = 40
      let maxY = 40

      for (const fIdx of seq) {
        const parts = frames[fIdx] || []
        for (const p of parts) {
          const slice = sprites[p.id]
          if (!slice) continue
          const px = p.dx
          const py = p.dy
          if (px < minX) minX = px
          if (py < minY) minY = py
          if (px + slice.w > maxX) maxX = px + slice.w
          if (py + slice.h > maxY) maxY = py + slice.h
        }
      }

      const rawCellW = Math.max(48, Math.ceil(maxX - minX + pad * 2))
      const rawCellH = Math.max(48, Math.ceil(maxY - minY + pad * 2))
      const cellW = rawCellW * scale
      const cellH = rawCellH * scale
      const totalFrames = seq.length
      const sheetW = cellW * totalFrames
      const sheetH = cellH

      canvas.width = sheetW
      canvas.height = sheetH
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, sheetW, sheetH)

      const originX = (-minX + pad) * scale
      const originY = (-minY + pad) * scale

      const meta: any[] = []

      for (let i = 0; i < seq.length; i++) {
        const fIdx = seq[i]
        const parts = frames[fIdx] || []
        const cellOffset = i * cellW

        for (const p of parts) {
          const slice = sprites[p.id]
          if (!slice) continue

          ctx.save()
          const drawX = cellOffset + originX + p.dx * scale
          const drawY = originY + p.dy * scale
          const drawW = slice.w * scale
          const drawH = slice.h * scale

          if (p.flip) {
            ctx.translate(drawX + drawW, drawY)
            ctx.scale(-1, 1)
            ctx.drawImage(mobImg, slice.x, slice.y, slice.w, slice.h, 0, 0, drawW, drawH)
          } else {
            ctx.drawImage(mobImg, slice.x, slice.y, slice.w, slice.h, drawX, drawY, drawW, drawH)
          }
          ctx.restore()
        }

        meta.push({
          index: i,
          frameId: fIdx,
          filename: `mob_${props.mob.id}_f${fIdx}_step${i}`,
          rect: {
            x: cellOffset,
            y: 0,
            width: cellW,
            height: cellH,
          },
          pivot: { x: 0.5, y: 0.0 },
          duration: 1 / exportFps.value,
        })
      }

      sheetDimensions.value = {
        width: sheetW,
        height: sheetH,
        cellW,
        cellH,
        count: totalFrames,
      }
      exportedFramesMeta.value = meta
    }
  } catch (err: any) {
    console.error('Lỗi sinh Spritesheet:', err)
    alert(`Không thể sinh Spritesheet: ${err.message}`)
  } finally {
    isGenerating.value = false
  }
}

// Download functions
async function downloadPng() {
  if (!previewCanvas.value) return
  const canvas = previewCanvas.value
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return

  const cleanName = props.mob.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mob_${props.mob.id}_${cleanName}_${selectedActionKey.value}_spritesheet.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadJson() {
  const cleanName = props.mob.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')
  const blob = new Blob([jsonString.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mob_${props.mob.id}_${cleanName}_${selectedActionKey.value}_animation.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonString.value)
    copiedToast.value = true
    setTimeout(() => {
      copiedToast.value = false
    }, 2000)
  } catch (err) {
    console.error('Lỗi copy JSON:', err)
  }
}

watch(
  [selectedActionKey, exportScale, padding, () => props.mob.id],
  () => {
    generateSpritesheet()
  }
)

watch(exportFps, (newFps) => {
  emit('fps-updated', newFps)
})

onMounted(() => {
  generateSpritesheet()
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
      <!-- Modal Header -->
      <header class="modal-header">
        <div class="header-left">
          <span class="header-icon">📦</span>
          <div>
            <div class="header-title-row">
              <h2 class="modal-title">Xuất Spritesheet Unity - {{ mob.name }}</h2>
              <span class="type-pill" :class="isComposite ? 'pill-boss' : 'pill-regular'">
                {{ isComposite ? '👑 Quái Boss / Ghép mảnh' : '👾 Quái thường (Frame rời)' }}
              </span>
            </div>
            <p class="modal-subtitle">
              ID #{{ mob.id }} • Cấp {{ mob.level }} • {{ isComposite ? `${mob.sprites.length} slices / ${mob.frames.length} frames` : `${mob.n_img} frames độc lập` }}
            </p>
          </div>
        </div>

        <button class="btn-close" @click="emit('close')">✕</button>
      </header>

      <!-- Action & Config Controls -->
      <section class="config-toolbar">
        <!-- Action Picker -->
        <div class="control-group">
          <label class="control-label">Hành động:</label>
          <select v-model="selectedActionKey" class="select-input">
            <option v-for="act in availableActions" :key="act.key" :value="act.key">
              {{ act.label }}
            </option>
          </select>
        </div>

        <!-- Scale Picker -->
        <div class="control-group">
          <label class="control-label">Độ phân giải:</label>
          <div class="pill-group">
            <button
              v-for="s in [1, 2, 4]"
              :key="s"
              class="pill-btn"
              :class="{ active: exportScale === s }"
              @click="exportScale = s"
            >
              {{ s }}x {{ s === 1 ? '(Gốc)' : s === 2 ? '(HD)' : '(Retina)' }}
            </button>
          </div>
        </div>

        <!-- FPS Slider -->
        <div class="control-group">
          <label class="control-label">Tốc độ (FPS): <span class="accent-text">{{ exportFps }}</span></label>
          <input
            v-model.number="exportFps"
            type="range"
            min="1"
            max="24"
            class="range-slider"
          />
        </div>

        <!-- Padding -->
        <div class="control-group">
          <label class="control-label">Đệm lề (px):</label>
          <select v-model.number="padding" class="select-input short">
            <option :value="0">0px (Khít)</option>
            <option :value="4">4px (Tiêu chuẩn)</option>
            <option :value="8">8px (Rộng)</option>
          </select>
        </div>

        <!-- Show Grid Toggle -->
        <div class="control-group">
          <button
            class="btn-toggle-grid"
            :class="{ active: showGrid }"
            @click="showGrid = !showGrid"
          >
            {{ showGrid ? '📐 Ẩn lưới ô' : '📐 Hiện lưới ô' }}
          </button>
        </div>
      </section>

      <!-- Main Tabs (Preview vs JSON) -->
      <div class="tabs-nav">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'preview' }"
          @click="activeTab = 'preview'"
        >
          🖼️ Xem trước Spritesheet ({{ sheetDimensions.width }} × {{ sheetDimensions.height }} px)
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'json' }"
          @click="activeTab = 'json'"
        >
          📄 Metadata JSON (Unity 2D)
        </button>
      </div>

      <!-- Tab Content 1: Canvas Preview -->
      <div v-show="activeTab === 'preview'" class="viewport-area">
        <div class="preview-zoom-bar">
          <span class="info-tag">
            Dải ngang: <strong>{{ sheetDimensions.count }} ô</strong> • Kích thước ô: <strong>{{ sheetDimensions.cellW }} × {{ sheetDimensions.cellH }} px</strong> • Thời lượng: <strong>{{ (sheetDimensions.count / exportFps).toFixed(2) }}s</strong>
          </span>
          <div class="zoom-controls">
            <span class="zoom-label">Thu phóng:</span>
            <button class="zoom-btn" @click="previewZoom = Math.max(0.5, previewZoom - 0.25)">-</button>
            <span class="zoom-val">{{ Math.round(previewZoom * 100) }}%</span>
            <button class="zoom-btn" @click="previewZoom = Math.min(3, previewZoom + 0.25)">+</button>
            <button class="zoom-btn reset" @click="previewZoom = 1">100%</button>
          </div>
        </div>

        <div class="canvas-scroll-container">
          <div
            class="canvas-wrapper"
            :style="{
              transform: `scale(${previewZoom})`,
              transformOrigin: 'top left',
            }"
          >
            <!-- Canvas -->
            <canvas ref="previewCanvas" class="sheet-canvas" />

            <!-- Frame Grid Overlay -->
            <div
              v-if="showGrid && sheetDimensions.count > 0"
              class="grid-overlay"
              :style="{
                width: `${sheetDimensions.width}px`,
                height: `${sheetDimensions.height}px`,
              }"
            >
              <div
                v-for="frame in exportedFramesMeta"
                :key="frame.index"
                class="grid-cell"
                :style="{
                  left: `${frame.rect.x}px`,
                  top: `${frame.rect.y}px`,
                  width: `${frame.rect.width}px`,
                  height: `${frame.rect.height}px`,
                }"
              >
                <span class="cell-label">#{{ frame.index }}</span>
                <span class="cell-sub">ID:{{ frame.frameId }}</span>
                <div class="pivot-dot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content 2: JSON Viewer -->
      <div v-show="activeTab === 'json'" class="json-area">
        <pre class="json-content"><code>{{ jsonString }}</code></pre>
      </div>

      <!-- Modal Footer -->
      <footer class="modal-footer">
        <div class="footer-left">
          <span v-if="copiedToast" class="toast-copied">✓ Đã sao chép JSON vào clipboard!</span>
          <span v-else class="unity-hint">
            💡 Kéo thả file PNG vào thư mục Assets của Unity, chọn Sprite Mode: Multiple, sau đó dùng Sprite Editor để cắt ô (Grid By Cell Count: {{ sheetDimensions.count }} cột).
          </span>
        </div>

        <div class="footer-actions">
          <button class="btn-secondary" @click="copyJson">
            📋 Sao chép JSON
          </button>
          <button class="btn-secondary" @click="downloadJson">
            📄 Tải Animation JSON
          </button>
          <button class="btn-primary" :disabled="isGenerating" @click="downloadPng">
            💾 Tải Spritesheet PNG
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-card {
  width: 960px;
  max-width: 95vw;
  max-height: 90vh;
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  color: var(--color-text, #E9EFEB);
}

.modal-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-surface-raised, #20282A);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 22px;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.modal-subtitle {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
  margin: 2px 0 0;
}

.type-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.2px;
}

.pill-boss {
  background-color: var(--color-accent-soft, #293A21);
  color: var(--color-accent, #B9F36B);
  border: 1px solid var(--color-accent, #B9F36B);
}

.pill-regular {
  background-color: #20282A;
  color: #70b4a4;
  border: 1px solid #344143;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-muted, #98A6A1);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-close:hover {
  background-color: var(--color-surface-hover, #293335);
  color: var(--color-text, #E9EFEB);
}

/* Config Toolbar */
.config-toolbar {
  padding: 10px 18px;
  background-color: var(--color-canvas, #101416);
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-muted, #98A6A1);
}

.accent-text {
  color: var(--color-accent, #B9F36B);
  font-family: monospace;
}

.select-input {
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11px;
  outline: none;
}

.select-input.short {
  width: 110px;
}

.pill-group {
  display: flex;
  gap: 4px;
}

.pill-btn {
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.pill-btn.active {
  background-color: var(--color-accent, #B9F36B);
  color: var(--color-accent-ink, #18210F);
  border-color: var(--color-accent, #B9F36B);
  font-weight: 700;
}

.range-slider {
  width: 80px;
}

.btn-toggle-grid {
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.btn-toggle-grid.active {
  border-color: var(--color-accent, #B9F36B);
  color: var(--color-accent, #B9F36B);
}

/* Tabs */
.tabs-nav {
  display: flex;
  border-bottom: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  padding: 0 18px;
}

.tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-muted, #98A6A1);
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-text, #E9EFEB);
}

.tab-btn.active {
  color: var(--color-accent, #B9F36B);
  border-bottom-color: var(--color-accent, #B9F36B);
}

/* Viewport Area */
.viewport-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 380px;
  max-height: 460px;
  background-color: var(--color-canvas, #101416);
  position: relative;
  overflow: hidden;
}

.preview-zoom-bar {
  padding: 6px 14px;
  background-color: rgba(32, 40, 42, 0.7);
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-tag {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
}

.info-tag strong {
  color: var(--color-text, #E9EFEB);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-label {
  font-size: 10px;
  color: var(--color-muted, #98A6A1);
}

.zoom-btn {
  background: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  width: 24px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.zoom-btn.reset {
  width: auto;
  padding: 0 6px;
  font-size: 10px;
}

.zoom-val {
  font-size: 10px;
  font-family: monospace;
  color: var(--color-accent, #B9F36B);
  min-width: 36px;
  text-align: center;
}

.canvas-scroll-container {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background-image:
    linear-gradient(45deg, #182022 25%, transparent 25%),
    linear-gradient(-45deg, #182022 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #182022 75%),
    linear-gradient(-45deg, transparent 75%, #182022 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.canvas-wrapper {
  position: relative;
  display: inline-block;
}

.sheet-canvas {
  display: block;
  image-rendering: pixelated;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  border: 1px solid var(--color-border, #344143);
  background-color: transparent;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.grid-cell {
  position: absolute;
  border: 1px dashed rgba(185, 243, 107, 0.4);
  box-sizing: border-box;
}

.cell-label {
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 9px;
  font-family: monospace;
  color: var(--color-accent, #B9F36B);
  background: rgba(16, 20, 22, 0.8);
  padding: 1px 3px;
  border-radius: 2px;
  line-height: 1;
}

.cell-sub {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 8px;
  font-family: monospace;
  color: var(--color-muted, #98A6A1);
  background: rgba(16, 20, 22, 0.8);
  padding: 1px 2px;
  border-radius: 2px;
  line-height: 1;
}

.pivot-dot {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 4px;
  height: 4px;
  background-color: #EF7772;
  border-radius: 50%;
  transform: translate(-50%, 50%);
}

/* JSON Area */
.json-area {
  flex: 1;
  min-height: 380px;
  max-height: 460px;
  overflow: auto;
  background-color: var(--color-canvas, #101416);
  padding: 16px;
}

.json-content {
  margin: 0;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-text, #E9EFEB);
}

/* Modal Footer */
.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface-raised, #20282A);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left {
  flex: 1;
  margin-right: 16px;
}

.unity-hint {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
}

.toast-copied {
  font-size: 11px;
  color: var(--color-accent, #B9F36B);
  font-weight: 600;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn-secondary {
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  padding: 8px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background-color: var(--color-surface-hover, #293335);
  border-color: var(--color-muted, #98A6A1);
}

.btn-primary {
  background-color: var(--color-accent, #B9F36B);
  color: var(--color-accent-ink, #18210F);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
