<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NsoMonsterDetail, NsoSpriteSlice, NsoFramePart } from '../types/nso'
import { fetchMonstersList, fetchMonsterDetail, saveMonsterDraft } from '../services/nso.api'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

const monsters = ref<any[]>([])
const selectedMobId = ref<number>(167) // Mặc định Thủy Tinh (có sẵn dữ liệu frames)
const currentMob = ref<NsoMonsterDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')

// Playback state
const isPlaying = ref(true)
const fps = ref(10)
const currentSequenceIdx = ref(0)
let timer: any = null

const activeSequence = computed<number[]>(() => {
  if (!currentMob.value) return [0]
  if (Array.isArray(currentMob.value.sequence) && currentMob.value.sequence.length > 0) {
    return currentMob.value.sequence
  }
  if (Array.isArray(currentMob.value.move) && currentMob.value.move.length > 0) {
    return currentMob.value.move
  }
  return [0]
})

const activeFrameIndex = computed(() => {
  return activeSequence.value[currentSequenceIdx.value % activeSequence.value.length] || 0
})

const activeFrame = computed<NsoFramePart[]>(() => {
  if (!currentMob.value || !currentMob.value.frames) return []
  return currentMob.value.frames[activeFrameIndex.value] || []
})

// Image source
const mobImageSrc = computed(() => {
  if (!currentMob.value) return ''
  return `/source-media/Mob/${currentMob.value.id}.png`
})

function step() {
  if (!isPlaying.value) return
  currentSequenceIdx.value = (currentSequenceIdx.value + 1) % activeSequence.value.length
}

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(step, 1000 / fps.value)
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

async function loadMonsters() {
  loading.value = true
  try {
    const res = await fetchMonstersList({ q: searchQuery.value, limit: 60 })
    monsters.value = res.monsters
    if (monsters.value.length > 0 && !currentMob.value) {
      selectMob(monsters.value.find((m) => m.id === 167)?.id || monsters.value[0].id)
    }
  } catch (err) {
    console.error('Lỗi tải quái vật:', err)
  } finally {
    loading.value = false
  }
}

async function selectMob(id: number) {
  selectedMobId.value = id
  try {
    currentMob.value = await fetchMonsterDetail(id)
    currentSequenceIdx.value = 0
  } catch (err) {
    console.error(`Lỗi tải chi tiết quái ${id}:`, err)
  }
}

async function saveCurrentMobDraft() {
  if (!currentMob.value) return
  saving.value = true
  try {
    await saveMonsterDraft(currentMob.value.id, currentMob.value)
    currentMob.value.isDraft = true
    const found = monsters.value.find((m) => m.id === currentMob.value!.id)
    if (found) found.isDraft = true
    emit('draft-updated')
  } catch (err) {
    console.error('Lỗi lưu nháp quái vật:', err)
  } finally {
    saving.value = false
  }
}

// ==================== XUẤT SPRITESHEET CHO UNITY ====================
const bakingMob = ref(false)

async function exportMobSpritesheetToUnity() {
  if (!currentMob.value || !mobImageSrc.value) return
  bakingMob.value = true

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Không thể tải ảnh gốc của quái vật'))
      img.src = mobImageSrc.value
    })

    const frames = currentMob.value.frames || []
    const seq = activeSequence.value
    let minX = 0, minY = 0, maxX = 40, maxY = 40

    for (const fIdx of seq) {
      const parts = frames[fIdx] || []
      for (const p of parts) {
        const slice = currentMob.value.sprites[p.id]
        if (!slice) continue
        const px = p.dx
        const py = p.dy
        if (px < minX) minX = px
        if (py < minY) minY = py
        if (px + slice.w > maxX) maxX = px + slice.w
        if (py + slice.h > maxY) maxY = py + slice.h
      }
    }

    const padding = 12
    const cellW = Math.max(48, Math.ceil(maxX - minX + padding * 2))
    const cellH = Math.max(48, Math.ceil(maxY - minY + padding * 2))
    const totalFrames = seq.length
    const sheetW = cellW * totalFrames
    const sheetH = cellH

    const canvas = document.createElement('canvas')
    canvas.width = sheetW
    canvas.height = sheetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context')

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, sheetW, sheetH)

    const originX = -minX + padding
    const originY = -minY + padding

    const slicesMeta: any[] = []

    for (let i = 0; i < seq.length; i++) {
      const fIdx = seq[i]!
      const parts = frames[fIdx] || []
      const cellOffset = i * cellW

      for (const p of parts) {
        const slice = currentMob.value.sprites[p.id]
        if (!slice) continue

        ctx.save()
        const drawX = cellOffset + originX + p.dx
        const drawY = originY + p.dy

        if (p.flip) {
          ctx.translate(drawX + slice.w, drawY)
          ctx.scale(-1, 1)
          ctx.drawImage(img, slice.x, slice.y, slice.w, slice.h, 0, 0, slice.w, slice.h)
        } else {
          ctx.drawImage(img, slice.x, slice.y, slice.w, slice.h, drawX, drawY, slice.w, slice.h)
        }
        ctx.restore()
      }

      slicesMeta.push({
        index: i,
        frameId: fIdx,
        rect: { x: cellOffset, y: 0, w: cellW, h: cellH },
        duration: 1 / fps.value,
      })
    }

    // Tải Spritesheet PNG
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mob_${currentMob.value.id}_spritesheet.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    // Tải Animation Metadata JSON
    const metaData = {
      entityName: currentMob.value.name,
      mobId: currentMob.value.id,
      fps: fps.value,
      totalFrames,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      cellWidth: cellW,
      cellHeight: cellH,
      frames: slicesMeta,
    }
    const metaBlob = new Blob([JSON.stringify(metaData, null, 2)], { type: 'application/json' })
    const metaUrl = URL.createObjectURL(metaBlob)
    const ma = document.createElement('a')
    ma.href = metaUrl
    ma.download = `mob_${currentMob.value.id}_animation.json`
    document.body.appendChild(ma)
    ma.click()
    document.body.removeChild(ma)
    URL.revokeObjectURL(metaUrl)
  } catch (err: any) {
    console.error('Lỗi xuất Spritesheet:', err)
    alert(`Lỗi xuất Spritesheet: ${err.message}`)
  } finally {
    bakingMob.value = false
  }
}

onMounted(() => {
  loadMonsters()
  startTimer()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="sprite-studio">
    <!-- Left: Danh sách Quái vật -->
    <aside class="mob-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Quái vật & Animation</span>
      </div>
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm quái..."
          class="input-search"
          @keyup.enter="loadMonsters"
        />
      </div>
      <div class="mob-list">
        <button
          v-for="mob in monsters"
          :key="mob.id"
          class="mob-row"
          :class="{ active: selectedMobId === mob.id, 'is-draft': mob.isDraft }"
          @click="selectMob(mob.id)"
        >
          <div class="mob-info">
            <span class="mob-name">{{ mob.name }}</span>
            <span class="mob-sub">#{{ mob.id }} • Cấp {{ mob.level }}</span>
          </div>
          <span v-if="mob.isDraft" class="draft-badge">Nháp</span>
        </button>
      </div>
    </aside>

    <!-- Center: Animation Player & Frame Stage -->
    <main class="mob-viewport" v-if="currentMob">
      <div class="viewport-toolbar">
        <div class="controls-left">
          <button class="btn-tool" @click="togglePlay">
            {{ isPlaying ? '⏸ Tạm dừng' : '▶ Phát tiếp' }}
          </button>
          <span class="tool-label">Tốc độ (FPS):</span>
          <input
            v-model.number="fps"
            type="range"
            min="2"
            max="30"
            class="range-slider"
            @input="startTimer"
          />
          <span class="fps-val">{{ fps }}</span>
        </div>

        <div class="controls-right">
          <span class="seq-info">
            Sequence Step: {{ currentSequenceIdx + 1 }}/{{ activeSequence.length }} (Frame #{{ activeFrameIndex }})
          </span>
          <button class="btn-save-draft" :disabled="saving" @click="saveCurrentMobDraft">
            {{ saving ? 'Đang lưu...' : '💾 Lưu Bản Nháp' }}
          </button>
          <button class="btn-export-unity" :disabled="bakingMob" @click="exportMobSpritesheetToUnity">
            {{ bakingMob ? '⏳ Đang xuất...' : '📦 Xuất Unity Spritesheet' }}
          </button>
        </div>
      </div>

      <!-- Stage -->
      <div class="stage-container">
        <div class="mob-stage">
          <div class="shadow-circle" />

          <!-- Render các lát sprite của Frame hiện tại -->
          <div
            v-for="(part, pIdx) in activeFrame"
            :key="pIdx"
            class="assembled-part"
            :style="{
              transform: `translate(${part.dx * 2.5}px, ${part.dy * 2.5}px) scaleX(${part.flip ? -1 : 1})`,
              zIndex: part.onTop ? 10 : 2,
            }"
          >
            <!-- Lấy tọa độ cắt x,y,w,h từ danh sách sprites -->
            <div
              v-if="currentMob.sprites[part.id]"
              class="sprite-slice-render"
              :style="{
                width: `${currentMob.sprites[part.id].w * 2.5}px`,
                height: `${currentMob.sprites[part.id].h * 2.5}px`,
                backgroundImage: `url(${mobImageSrc})`,
                backgroundPosition: `-${currentMob.sprites[part.id].x * 2.5}px -${currentMob.sprites[part.id].y * 2.5}px`,
                backgroundSize: 'auto',
              }"
            />
          </div>
        </div>
      </div>

      <!-- Timeline & Slices Strip -->
      <div class="bottom-timeline">
        <div class="timeline-title">
          <span>Chuỗi Frame Sequence:</span>
        </div>
        <div class="sequence-strip">
          <div
            v-for="(fIdx, sIdx) in activeSequence"
            :key="sIdx"
            class="seq-box"
            :class="{ active: sIdx === currentSequenceIdx }"
            @click="currentSequenceIdx = sIdx"
          >
            <span class="seq-label">#{{ fIdx }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Right Inspector: Quản lý Sprites & Frames -->
    <aside class="mob-inspector" v-if="currentMob">
      <div class="inspector-header">
        <span class="inspector-title">Metadata Quái #{{ currentMob.id }}</span>
      </div>

      <div class="inspector-scroll">
        <div class="form-group">
          <label>Tên Quái vật:</label>
          <input v-model="currentMob.name" type="text" class="input-text" />
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Máu (HP):</label>
            <input v-model.number="currentMob.hp" type="number" class="input-text" />
          </div>
          <div class="form-group half">
            <label>Cấp độ:</label>
            <input v-model.number="currentMob.level" type="number" class="input-text" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Tốc độ chạy:</label>
            <input v-model.number="currentMob.speed" type="number" class="input-text" />
          </div>
          <div class="form-group half">
            <label>Tầm di chuyển:</label>
            <input v-model.number="currentMob.range_move" type="number" class="input-text" />
          </div>
        </div>

        <!-- Slices List -->
        <div class="slices-section">
          <label class="section-label">Lát cắt Sprites ({{ currentMob.sprites.length }} slices):</label>
          <div class="slices-grid">
            <div
              v-for="slice in currentMob.sprites.slice(0, 30)"
              :key="slice.id"
              class="slice-item"
            >
              <span class="slice-id">#{{ slice.id }}</span>
              <span class="slice-dims">{{ slice.w }}x{{ slice.h }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.sprite-studio {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--color-canvas, #101416);
  color: var(--color-text, #E9EFEB);
}

.mob-sidebar {
  width: 260px;
  border-right: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #344143;
}

.sidebar-title {
  font-weight: 600;
  font-size: 13px;
}

.search-box {
  padding: 8px 12px;
  border-bottom: 1px solid #344143;
}

.input-search {
  width: 100%;
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
}

.mob-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.mob-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.mob-row:hover {
  background-color: #20282A;
}

.mob-row.active {
  background-color: #293A21;
}

.mob-name {
  font-size: 12px;
  font-weight: 600;
  color: #E9EFEB;
  display: block;
}

.mob-sub {
  font-size: 10px;
  color: #72827e;
}

.draft-badge {
  font-size: 9px;
  background-color: #F1A773;
  color: #18210F;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.mob-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #0c0f11;
}

.viewport-toolbar {
  height: 48px;
  border-bottom: 1px solid #344143;
  background-color: #171D1F;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
}

.controls-left, .controls-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-tool {
  padding: 5px 12px;
  background: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.tool-label, .seq-info {
  font-size: 11px;
  color: #98A6A1;
}

.range-slider {
  width: 90px;
}

.fps-val {
  font-family: monospace;
  font-size: 11px;
  color: #B9F36B;
}

.btn-save-draft {
  padding: 6px 14px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.btn-export-unity {
  padding: 6px 12px;
  background-color: #20282A;
  border: 1px solid #B9F36B;
  color: #B9F36B;
  border-radius: 4px;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-export-unity:hover:not(:disabled) {
  background-color: #293A21;
}

.btn-export-unity:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stage-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.mob-stage {
  width: 200px;
  height: 200px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shadow-circle {
  position: absolute;
  bottom: 20px;
  width: 120px;
  height: 20px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%);
  border-radius: 50%;
}

.assembled-part {
  position: absolute;
  top: 50%;
  left: 50%;
  image-rendering: pixelated;
  transform-origin: center;
}

.sprite-slice-render {
  image-rendering: pixelated;
}

.bottom-timeline {
  height: 70px;
  border-top: 1px solid #344143;
  background-color: #171D1F;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeline-title {
  font-size: 11px;
  color: #98A6A1;
  font-weight: 600;
}

.sequence-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.seq-box {
  min-width: 36px;
  height: 32px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.seq-box.active {
  background-color: #293A21;
  border-color: #B9F36B;
}

.seq-label {
  font-family: monospace;
  font-size: 10px;
  color: #B9F36B;
}

.mob-inspector {
  width: 280px;
  border-left: 1px solid #344143;
  background-color: #171D1F;
  display: flex;
  flex-direction: column;
}

.inspector-header {
  padding: 12px;
  border-bottom: 1px solid #344143;
}

.inspector-title {
  font-size: 12px;
  font-weight: 600;
}

.inspector-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 11px;
  color: #98A6A1;
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-row .half {
  flex: 1;
}

.input-text {
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
}

.slices-section {
  border-top: 1px solid #344143;
  padding-top: 10px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #98A6A1;
  margin-bottom: 8px;
  display: block;
}

.slices-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.slice-item {
  background-color: #101416;
  border: 1px solid #344143;
  padding: 4px;
  border-radius: 3px;
  text-align: center;
}

.slice-id {
  display: block;
  font-size: 10px;
  color: #B9F36B;
  font-family: monospace;
}

.slice-dims {
  font-size: 8px;
  color: #72827e;
}
</style>
