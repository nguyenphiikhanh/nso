<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { NsoMonsterDetail, NsoMonsterSummary, NsoSpriteSlice, NsoFramePart } from '../types/nso'
import { fetchMonstersList, fetchMonsterDetail, saveMonsterDraft } from '../services/nso.api'
import MonsterUnityExportModal from './MonsterUnityExportModal.vue'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

// List state
const monsters = ref<NsoMonsterSummary[]>([])
const selectedMobId = ref<number>(0)
const currentMob = ref<NsoMonsterDetail | null>(null)
const loadingList = ref(false)
const loadingDetail = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const filterType = ref<'all' | 'regular' | 'boss' | 'draft'>('all')

// Playback state
const isPlaying = ref(true)
const fps = ref(8) // Default 8 FPS as chosen in Socratic Gate
const playMode = ref<'loop' | 'pingpong'>('loop')
const pingPongDirection = ref<1 | -1>(1)
const currentSequenceIdx = ref(0)
let timer: any = null

// Viewport stage controls
const zoomScale = ref<number>(2.5) // 1x, 2x, 2.5x, 3x, 4x
const flipX = ref(false)
const stageBg = ref<'grid' | 'dark' | 'light' | 'green'>('grid')
const showGuides = ref(false)
const selectedActionType = ref<'move' | 'attack_0' | 'attack_1' | 'stand'>('move')

// Modals
const showExportModal = ref(false)

// Computed check for composite (Boss) vs sequential (Regular)
const isCurrentComposite = computed<boolean>(() => {
  if (!currentMob.value) return false
  if (currentMob.value.is_composite !== undefined) {
    return Boolean(currentMob.value.is_composite)
  }
  return Boolean(
    Array.isArray(currentMob.value.sprites) &&
    currentMob.value.sprites.length > 0 &&
    Array.isArray(currentMob.value.frames) &&
    currentMob.value.frames.length > 0
  )
})

// Active sequence of frames depending on monster type and selected action
const activeSequence = computed<number[]>(() => {
  if (!currentMob.value) return [0]

  if (!isCurrentComposite.value) {
    // Quái thường: Chuỗi frame tuần tự 0..n_img-1
    const count = Math.max(1, currentMob.value.n_img || 1)
    return Array.from({ length: count }, (_, i) => i)
  }

  // Quái Boss: Dựa vào action được chọn
  if (selectedActionType.value === 'stand') {
    return [0]
  }

  if (selectedActionType.value === 'attack_0' && Array.isArray(currentMob.value.attack?.[0]) && currentMob.value.attack[0].length > 0) {
    return currentMob.value.attack[0]
  }

  if (selectedActionType.value === 'attack_1' && Array.isArray(currentMob.value.attack?.[1]) && currentMob.value.attack[1].length > 0) {
    return currentMob.value.attack[1]
  }

  if (Array.isArray(currentMob.value.move) && currentMob.value.move.length > 0) {
    return currentMob.value.move
  }

  if (Array.isArray(currentMob.value.sequence) && currentMob.value.sequence.length > 0) {
    return currentMob.value.sequence
  }

  return [0]
})

// Current active frame index in sequence
const activeFrameIndex = computed<number>(() => {
  const seq = activeSequence.value
  if (!seq || seq.length === 0) return 0
  return seq[currentSequenceIdx.value % seq.length] || 0
})

// Active composite frame parts (only for Boss)
const activeFrameParts = computed<NsoFramePart[]>(() => {
  if (!isCurrentComposite.value || !currentMob.value || !currentMob.value.frames) return []
  return currentMob.value.frames[activeFrameIndex.value] || []
})

// Image source for Boss base sheet
const bossSheetSrc = computed(() => {
  if (!currentMob.value) return ''
  return `/source-media/Mob/${currentMob.value.id}_0.png`
})

// Image source for Regular mob active frame
const regularFrameSrc = computed(() => {
  if (!currentMob.value) return ''
  return `/source-media/Mob/${currentMob.value.id}_${activeFrameIndex.value}.png`
})

// Filtered monsters list
const filteredMonsters = computed(() => {
  let list = monsters.value

  if (filterType.value === 'regular') {
    list = list.filter((m) => !m.is_composite)
  } else if (filterType.value === 'boss') {
    list = list.filter((m) => Boolean(m.is_composite))
  } else if (filterType.value === 'draft') {
    list = list.filter((m) => m.isDraft)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (m) =>
        String(m.id).includes(q) ||
        m.name.toLowerCase().includes(q)
    )
  }

  return list
})

// Animation Step
function step() {
  if (!isPlaying.value) return
  const seqLen = activeSequence.value.length
  if (seqLen <= 1) return

  if (playMode.value === 'loop') {
    currentSequenceIdx.value = (currentSequenceIdx.value + 1) % seqLen
  } else {
    // Ping-Pong
    let nextIdx = currentSequenceIdx.value + pingPongDirection.value
    if (nextIdx >= seqLen) {
      pingPongDirection.value = -1
      nextIdx = Math.max(0, seqLen - 2)
    } else if (nextIdx < 0) {
      pingPongDirection.value = 1
      nextIdx = Math.min(seqLen - 1, 1)
    }
    currentSequenceIdx.value = nextIdx
  }
}

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(step, 1000 / fps.value)
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function stepPrev() {
  isPlaying.value = false
  const seqLen = activeSequence.value.length
  if (seqLen <= 1) return
  currentSequenceIdx.value = (currentSequenceIdx.value - 1 + seqLen) % seqLen
}

function stepNext() {
  isPlaying.value = false
  const seqLen = activeSequence.value.length
  if (seqLen <= 1) return
  currentSequenceIdx.value = (currentSequenceIdx.value + 1) % seqLen
}

function togglePlayMode() {
  playMode.value = playMode.value === 'loop' ? 'pingpong' : 'loop'
  pingPongDirection.value = 1
}

// Data loading
async function loadMonsters() {
  loadingList.value = true
  try {
    const res = await fetchMonstersList({ limit: 300 })
    monsters.value = res.monsters
    if (monsters.value.length > 0 && !currentMob.value) {
      // Ưu tiên chọn quái 0 (Bù nhìn) hoặc giữ selection hiện tại
      const initial = monsters.value.find((m) => m.id === selectedMobId.value) || monsters.value[0]
      selectMob(initial.id)
    }
  } catch (err) {
    console.error('Lỗi tải danh sách quái:', err)
  } finally {
    loadingList.value = false
  }
}

async function selectMob(id: number) {
  selectedMobId.value = id
  loadingDetail.value = true
  try {
    const mob = await fetchMonsterDetail(id)
    currentMob.value = mob
    currentSequenceIdx.value = 0
    pingPongDirection.value = 1
    selectedActionType.value = 'move'
  } catch (err) {
    console.error(`Lỗi tải chi tiết quái #${id}:`, err)
  } finally {
    loadingDetail.value = false
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
    alert('Không thể lưu bản nháp.')
  } finally {
    saving.value = false
  }
}

watch(fps, () => {
  startTimer()
})

watch(selectedActionType, () => {
  currentSequenceIdx.value = 0
  pingPongDirection.value = 1
})

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
    <!-- Left Sidebar: Danh sách Quái vật -->
    <aside class="mob-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <span class="sidebar-title">Quái vật & Animation</span>
          <span class="count-badge">{{ filteredMonsters.length }} / {{ monsters.length }}</span>
        </div>

        <div class="filter-tabs">
          <button
            class="filter-pill"
            :class="{ active: filterType === 'all' }"
            @click="filterType = 'all'"
          >
            Tất cả
          </button>
          <button
            class="filter-pill"
            :class="{ active: filterType === 'regular' }"
            @click="filterType = 'regular'"
          >
            Thường
          </button>
          <button
            class="filter-pill"
            :class="{ active: filterType === 'boss' }"
            @click="filterType = 'boss'"
          >
            Boss
          </button>
          <button
            class="filter-pill"
            :class="{ active: filterType === 'draft' }"
            @click="filterType = 'draft'"
          >
            Nháp
          </button>
        </div>

        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm theo tên hoặc ID..."
            class="input-search"
          />
        </div>
      </div>

      <div class="mob-list">
        <div v-if="loadingList" class="loading-state">
          Đang tải danh sách quái...
        </div>
        <div v-else-if="filteredMonsters.length === 0" class="empty-state">
          Không tìm thấy quái phù hợp.
        </div>
        <button
          v-for="mob in filteredMonsters"
          v-else
          :key="mob.id"
          class="mob-row"
          :class="{ active: selectedMobId === mob.id, 'is-draft': mob.isDraft }"
          @click="selectMob(mob.id)"
        >
          <!-- Thumbnail preview -->
          <div class="mob-thumb-box">
            <img
              :src="`/source-media/Mob/${mob.id}_0.png`"
              class="mob-thumb-img"
              loading="lazy"
              alt=""
              @error="($event.target as HTMLElement).style.display = 'none'"
            />
          </div>

          <div class="mob-info">
            <div class="mob-name-row">
              <span class="mob-name">{{ mob.name }}</span>
              <span v-if="mob.is_composite" class="badge-boss">Boss</span>
              <span v-else class="badge-regular">{{ mob.n_img }}f</span>
            </div>
            <span class="mob-sub">#{{ mob.id }} • Cấp {{ mob.level }} • HP {{ mob.hp.toLocaleString() }}</span>
          </div>

          <span v-if="mob.isDraft" class="draft-badge">Nháp</span>
        </button>
      </div>
    </aside>

    <!-- Center: Main Viewport & Stage -->
    <main v-if="currentMob" class="mob-viewport">
      <!-- Toolbar Controls -->
      <div class="viewport-toolbar">
        <div class="controls-left">
          <!-- Play / Pause -->
          <button class="btn-tool" :class="{ 'btn-playing': isPlaying }" @click="togglePlay">
            {{ isPlaying ? '⏸ Tạm dừng' : '▶ Phát tiếp' }}
          </button>

          <!-- Step Back / Forward -->
          <button class="btn-icon" title="Frame trước" @click="stepPrev">⏮</button>
          <button class="btn-icon" title="Frame kế tiếp" @click="stepNext">⏭</button>

          <!-- Play Mode Toggle -->
          <button
            class="btn-tool mode-btn"
            :title="playMode === 'loop' ? 'Lặp tuần hoàn (0->1->2->0)' : 'Lặp đảo chiều (0->1->2->1->0)'"
            @click="togglePlayMode"
          >
            {{ playMode === 'loop' ? '🔁 Lặp lại' : '↔️ Ping-Pong' }}
          </button>

          <div class="tool-divider" />

          <!-- FPS Slider -->
          <span class="tool-label">Tốc độ (FPS):</span>
          <input
            v-model.number="fps"
            type="range"
            min="1"
            max="24"
            class="range-slider"
          />
          <span class="fps-val">{{ fps }}</span>

          <div class="tool-divider" />

          <!-- Zoom Selector -->
          <span class="tool-label">Zoom:</span>
          <div class="zoom-pill-group">
            <button
              v-for="z in [1, 2, 2.5, 3, 4]"
              :key="z"
              class="zoom-pill"
              :class="{ active: zoomScale === z }"
              @click="zoomScale = z"
            >
              {{ z }}x
            </button>
          </div>

          <!-- Flip X Toggle -->
          <button
            class="btn-tool"
            :class="{ active: flipX }"
            title="Đảo chiều trái / phải"
            @click="flipX = !flipX"
          >
            ⇋ Lật X
          </button>
        </div>

        <div class="controls-right">
          <!-- Background Mode -->
          <select v-model="stageBg" class="select-bg" title="Chọn phông nền sân khấu">
            <option value="grid">Lưới caro</option>
            <option value="dark">Nền tối</option>
            <option value="light">Nền sáng</option>
            <option value="green">Phông xanh</option>
          </select>

          <!-- Show Guides -->
          <button
            class="btn-icon-toggle"
            :class="{ active: showGuides }"
            title="Hiện đường gióng tâm & Hitbox"
            @click="showGuides = !showGuides"
          >
            📐
          </button>

          <div class="tool-divider" />

          <!-- Action Buttons -->
          <button class="btn-save-draft" :disabled="saving" @click="saveCurrentMobDraft">
            {{ saving ? 'Đang lưu...' : '💾 Lưu Nháp' }}
          </button>
          <button class="btn-export-unity" @click="showExportModal = true">
            📦 Xuất Unity Spritesheet
          </button>
        </div>
      </div>

      <!-- Action Selector Sub-bar (nếu là Boss có nhiều animation) -->
      <div v-if="isCurrentComposite" class="action-subbar">
        <span class="subbar-label">Động tác (Animation Action):</span>
        <div class="action-pills">
          <button
            class="action-pill"
            :class="{ active: selectedActionType === 'move' }"
            @click="selectedActionType = 'move'"
          >
            🏃 Di chuyển ({{ currentMob.move?.length || 0 }} nhịp)
          </button>
          <button
            v-if="currentMob.attack?.[0]?.length"
            class="action-pill"
            :class="{ active: selectedActionType === 'attack_0' }"
            @click="selectedActionType = 'attack_0'"
          >
            ⚔️ Tấn công 1 ({{ currentMob.attack[0].length }} nhịp)
          </button>
          <button
            v-if="currentMob.attack?.[1]?.length"
            class="action-pill"
            :class="{ active: selectedActionType === 'attack_1' }"
            @click="selectedActionType = 'attack_1'"
          >
            ⚡ Tấn công 2 ({{ currentMob.attack[1].length }} nhịp)
          </button>
          <button
            class="action-pill"
            :class="{ active: selectedActionType === 'stand' }"
            @click="selectedActionType = 'stand'"
          >
            🧘 Đứng yên (Frame #0)
          </button>
        </div>
      </div>

      <!-- Stage Container -->
      <div class="stage-container" :class="`bg-${stageBg}`">
        <!-- Crosshair & Origin Guide -->
        <div v-if="showGuides" class="origin-crosshair">
          <div class="crosshair-x" />
          <div class="crosshair-y" />
        </div>

        <!-- Monster Stage Root -->
        <div
          class="mob-stage"
          :style="{
            transform: `scale(${zoomScale}) scaleX(${flipX ? -1 : 1})`,
          }"
        >
          <!-- Ground shadow -->
          <div class="shadow-circle" />

          <!-- 1. QUÁI THƯỜNG: Render ảnh frame tuần tự -->
          <div v-if="!isCurrentComposite" class="regular-mob-wrapper">
            <img
              :src="regularFrameSrc"
              class="regular-frame-img"
              :class="{ 'guide-bounds': showGuides }"
              alt=""
            />
          </div>

          <!-- 2. QUÁI BOSS: Lắp ghép các mảnh sprite theo khung xương frames -->
          <div v-else class="composite-mob-wrapper" :class="{ 'guide-bounds': showGuides }">
            <div
              v-for="(part, pIdx) in activeFrameParts"
              :key="pIdx"
              class="assembled-part"
              :style="{
                transform: `translate(${part.dx}px, ${part.dy}px) scaleX(${part.flip ? -1 : 1})`,
                zIndex: part.onTop ? 10 : 2,
              }"
            >
              <div
                v-if="currentMob.sprites[part.id]"
                class="sprite-slice-render"
                :style="{
                  width: `${currentMob.sprites[part.id].w}px`,
                  height: `${currentMob.sprites[part.id].h}px`,
                  backgroundImage: `url(${bossSheetSrc})`,
                  backgroundPosition: `-${currentMob.sprites[part.id].x}px -${currentMob.sprites[part.id].y}px`,
                }"
              />
            </div>
          </div>
        </div>

        <!-- Info HUD Overlay -->
        <div class="stage-hud">
          <span class="hud-pill">
            {{ isCurrentComposite ? '👑 Quái Boss (Ghép mảnh)' : '👾 Quái thường (Frame rời)' }}
          </span>
          <span class="hud-pill">
            Nhịp: <strong>{{ currentSequenceIdx + 1 }}/{{ activeSequence.length }}</strong>
          </span>
          <span class="hud-pill">
            Frame: <strong>#{{ activeFrameIndex }}</strong>
          </span>
          <span class="hud-pill">
            Thời lượng: <strong>{{ Math.round(1000 / fps) }}ms</strong>
          </span>
        </div>
      </div>

      <!-- Bottom Timeline & Frame Strip -->
      <div class="bottom-timeline">
        <div class="timeline-header">
          <span class="timeline-title">Chuỗi nhịp diễn hoạt (Sequence Timeline):</span>
          <span class="timeline-meta">
            Tổng cộng: {{ activeSequence.length }} nhịp • {{ (activeSequence.length / fps).toFixed(2) }} giây một vòng
          </span>
        </div>

        <div class="sequence-strip">
          <div
            v-for="(fIdx, sIdx) in activeSequence"
            :key="sIdx"
            class="seq-box"
            :class="{ active: sIdx === currentSequenceIdx }"
            @click="currentSequenceIdx = sIdx"
          >
            <div class="seq-thumb">
              <!-- Thumbnail for regular mob -->
              <img
                v-if="!isCurrentComposite"
                :src="`/source-media/Mob/${currentMob.id}_${fIdx}.png`"
                class="seq-thumb-img"
                alt=""
              />
              <!-- Label for boss frame -->
              <span v-else class="seq-boss-label">F#{{ fIdx }}</span>
            </div>
            <div class="seq-footer">
              <span class="seq-step-idx">#{{ sIdx + 1 }}</span>
              <span class="seq-frame-id">F:{{ fIdx }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Right Inspector: Metadata & Details -->
    <aside v-if="currentMob" class="mob-inspector">
      <div class="inspector-header">
        <span class="inspector-title">Thuộc tính Quái #{{ currentMob.id }}</span>
        <span class="type-tag" :class="isCurrentComposite ? 'tag-boss' : 'tag-regular'">
          {{ isCurrentComposite ? 'Boss' : 'Thường' }}
        </span>
      </div>

      <div class="inspector-scroll">
        <div class="form-group">
          <label>Tên Quái vật:</label>
          <input v-model="currentMob.name" type="text" class="input-text" />
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Cấp độ (Level):</label>
            <input v-model.number="currentMob.level" type="number" class="input-text" />
          </div>
          <div class="form-group half">
            <label>Máu (HP):</label>
            <input v-model.number="currentMob.hp" type="number" class="input-text" />
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

        <div class="form-row">
          <div class="form-group half">
            <label>Loại bay (Fly):</label>
            <select v-model.number="currentMob.type_fly" class="input-text">
              <option :value="0">0: Đi bộ</option>
              <option :value="1">1: Bay trên không</option>
            </select>
          </div>
          <div class="form-group half">
            <label>Hệ / Type:</label>
            <input v-model.number="currentMob.type" type="number" class="input-text" />
          </div>
        </div>

        <!-- Section: Frame Structure Details -->
        <div class="detail-section">
          <div class="section-title-row">
            <span class="section-title">
              {{ isCurrentComposite ? `Lát cắt Sprites (${currentMob.sprites.length})` : `Thư viện Frame ảnh (${currentMob.n_img})` }}
            </span>
          </div>

          <!-- Regular mob frames list -->
          <div v-if="!isCurrentComposite" class="regular-frames-grid">
            <div
              v-for="idx in currentMob.n_img"
              :key="idx - 1"
              class="frame-thumb-card"
              :class="{ active: (idx - 1) === activeFrameIndex }"
              @click="currentSequenceIdx = (idx - 1)"
            >
              <img
                :src="`/source-media/Mob/${currentMob.id}_${idx - 1}.png`"
                class="frame-card-img"
                alt=""
              />
              <span class="frame-card-label">Frame {{ idx - 1 }}</span>
            </div>
          </div>

          <!-- Boss mob slices list -->
          <div v-else class="slices-grid">
            <div
              v-for="slice in currentMob.sprites.slice(0, 36)"
              :key="slice.id"
              class="slice-item"
            >
              <span class="slice-id">#{{ slice.id }}</span>
              <span class="slice-dims">{{ slice.w }}×{{ slice.h }}</span>
            </div>
          </div>
          <p v-if="isCurrentComposite && currentMob.sprites.length > 36" class="more-hint">
            ... và {{ currentMob.sprites.length - 36 }} lát cắt khác.
          </p>
        </div>
      </div>
    </aside>

    <!-- Unity Export Modal -->
    <MonsterUnityExportModal
      v-if="showExportModal && currentMob"
      :mob="currentMob"
      :is-composite="isCurrentComposite"
      :fps="fps"
      :active-sequence="activeSequence"
      @fps-updated="fps = $event"
      @close="showExportModal = false"
    />
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

/* Sidebar */
.mob-sidebar {
  width: 270px;
  border-right: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-title {
  font-weight: 700;
  font-size: 13px;
}

.count-badge {
  font-size: 10px;
  font-family: monospace;
  color: var(--color-muted, #98A6A1);
  background: var(--color-canvas, #101416);
  padding: 1px 6px;
  border-radius: 4px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.filter-pill {
  flex: 1;
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-muted, #98A6A1);
  font-size: 10px;
  padding: 3px 0;
  border-radius: 3px;
  cursor: pointer;
}

.filter-pill.active {
  background-color: var(--color-accent-soft, #293A21);
  border-color: var(--color-accent, #B9F36B);
  color: var(--color-accent, #B9F36B);
  font-weight: 700;
}

.search-box {
  width: 100%;
}

.input-search {
  width: 100%;
  padding: 6px 8px;
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.input-search:focus {
  border-color: var(--color-accent, #B9F36B);
}

.mob-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.loading-state, .empty-state {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--color-muted, #98A6A1);
}

.mob-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
}

.mob-row:hover {
  background-color: var(--color-surface-hover, #293335);
}

.mob-row.active {
  background-color: var(--color-surface-raised, #20282A);
  border-color: var(--color-accent, #B9F36B);
}

.mob-thumb-box {
  width: 32px;
  height: 32px;
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.mob-thumb-img {
  max-width: 28px;
  max-height: 28px;
  image-rendering: pixelated;
  object-fit: contain;
}

.mob-info {
  flex: 1;
  min-width: 0;
}

.mob-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mob-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text, #E9EFEB);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-boss {
  font-size: 9px;
  font-weight: 700;
  background-color: var(--color-accent-soft, #293A21);
  color: var(--color-accent, #B9F36B);
  padding: 0 4px;
  border-radius: 3px;
}

.badge-regular {
  font-size: 9px;
  background-color: #20282A;
  color: #72827e;
  padding: 0 4px;
  border-radius: 3px;
  font-family: monospace;
}

.mob-sub {
  font-size: 10px;
  color: var(--color-muted, #98A6A1);
  display: block;
}

.draft-badge {
  font-size: 9px;
  background-color: var(--color-warm, #F1A773);
  color: #18210F;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
}

/* Viewport Main */
.mob-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-canvas, #101416);
  overflow: hidden;
}

.viewport-toolbar {
  height: 48px;
  border-bottom: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
}

.controls-left, .controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-tool {
  padding: 5px 10px;
  background: var(--color-surface-raised, #20282A);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.btn-tool:hover {
  background-color: var(--color-surface-hover, #293335);
}

.btn-tool.active, .btn-tool.btn-playing {
  border-color: var(--color-accent, #B9F36B);
  color: var(--color-accent, #B9F36B);
}

.btn-icon {
  background: var(--color-surface-raised, #20282A);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  width: 28px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.btn-icon-toggle {
  background: var(--color-surface-raised, #20282A);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-muted, #98A6A1);
  width: 28px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.btn-icon-toggle.active {
  border-color: var(--color-accent, #B9F36B);
  color: var(--color-accent, #B9F36B);
}

.tool-divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border, #344143);
  margin: 0 2px;
}

.tool-label {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
}

.range-slider {
  width: 75px;
}

.fps-val {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-accent, #B9F36B);
  min-width: 16px;
}

.zoom-pill-group {
  display: flex;
  gap: 2px;
}

.zoom-pill {
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
}

.zoom-pill.active {
  background-color: var(--color-accent, #B9F36B);
  color: var(--color-accent-ink, #18210F);
  font-weight: 700;
  border-color: var(--color-accent, #B9F36B);
}

.select-bg {
  background-color: var(--color-surface-raised, #20282A);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
}

.btn-save-draft {
  padding: 6px 12px;
  background-color: var(--color-surface-raised, #20282A);
  color: var(--color-text, #E9EFEB);
  border: 1px solid var(--color-border, #344143);
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
  cursor: pointer;
}

.btn-save-draft:hover {
  background-color: var(--color-surface-hover, #293335);
}

.btn-export-unity {
  padding: 6px 14px;
  background-color: var(--color-accent, #B9F36B);
  color: var(--color-accent-ink, #18210F);
  border: none;
  border-radius: 4px;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-export-unity:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* Action Subbar */
.action-subbar {
  padding: 6px 16px;
  background-color: var(--color-surface-raised, #20282A);
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  align-items: center;
  gap: 10px;
}

.subbar-label {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
  font-weight: 600;
}

.action-pills {
  display: flex;
  gap: 6px;
}

.action-pill {
  background: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.action-pill.active {
  background-color: var(--color-accent-soft, #293A21);
  border-color: var(--color-accent, #B9F36B);
  color: var(--color-accent, #B9F36B);
  font-weight: 700;
}

/* Stage Container */
.stage-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.stage-container.bg-grid {
  background-color: #0d1113;
  background-image:
    linear-gradient(45deg, #151b1e 25%, transparent 25%),
    linear-gradient(-45deg, #151b1e 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #151b1e 75%),
    linear-gradient(-45deg, transparent 75%, #151b1e 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.stage-container.bg-dark {
  background-color: #0a0d0e;
}

.stage-container.bg-light {
  background-color: #E9EFEB;
}

.stage-container.bg-green {
  background-color: #00FF00;
}

.origin-crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
}

.crosshair-x {
  position: absolute;
  left: -150px;
  top: 0;
  width: 300px;
  height: 1px;
  background-color: rgba(185, 243, 107, 0.4);
}

.crosshair-y {
  position: absolute;
  top: -150px;
  left: 0;
  height: 300px;
  width: 1px;
  background-color: rgba(185, 243, 107, 0.4);
}

.mob-stage {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transform-origin: center bottom;
  image-rendering: pixelated;
}

.shadow-circle {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 14px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
}

.regular-mob-wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.regular-frame-img {
  display: block;
  image-rendering: pixelated;
  user-select: none;
}

.composite-mob-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  z-index: 2;
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

.guide-bounds {
  outline: 1px dashed rgba(185, 243, 107, 0.6);
}

.stage-hud {
  position: absolute;
  bottom: 12px;
  left: 16px;
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.hud-pill {
  font-size: 10px;
  color: var(--color-muted, #98A6A1);
  background: rgba(16, 20, 22, 0.8);
  border: 1px solid var(--color-border, #344143);
  padding: 3px 8px;
  border-radius: 4px;
}

.hud-pill strong {
  color: var(--color-text, #E9EFEB);
}

/* Timeline */
.bottom-timeline {
  height: 86px;
  border-top: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-title {
  font-size: 11px;
  color: var(--color-muted, #98A6A1);
  font-weight: 600;
}

.timeline-meta {
  font-size: 10px;
  color: var(--color-muted, #98A6A1);
  font-family: monospace;
}

.sequence-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.seq-box {
  min-width: 44px;
  height: 48px;
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 2px;
  transition: all 0.12s ease;
  flex-shrink: 0;
}

.seq-box:hover {
  border-color: var(--color-muted, #98A6A1);
}

.seq-box.active {
  background-color: var(--color-surface-raised, #20282A);
  border-color: var(--color-accent, #B9F36B);
}

.seq-thumb {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.seq-thumb-img {
  max-width: 32px;
  max-height: 28px;
  image-rendering: pixelated;
  object-fit: contain;
}

.seq-boss-label {
  font-size: 9px;
  font-family: monospace;
  color: var(--color-accent, #B9F36B);
}

.seq-footer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  font-family: monospace;
  color: var(--color-muted, #98A6A1);
  padding: 0 2px;
}

/* Right Inspector */
.mob-inspector {
  width: 280px;
  border-left: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
}

.inspector-header {
  padding: 12px;
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inspector-title {
  font-size: 12px;
  font-weight: 700;
}

.type-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
}

.tag-boss {
  background-color: var(--color-accent-soft, #293A21);
  color: var(--color-accent, #B9F36B);
}

.tag-regular {
  background-color: #20282A;
  color: #70b4a4;
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
  color: var(--color-muted, #98A6A1);
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
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  color: var(--color-text, #E9EFEB);
  border-radius: 4px;
  font-size: 11px;
  outline: none;
}

.input-text:focus {
  border-color: var(--color-accent, #B9F36B);
}

.detail-section {
  border-top: 1px solid var(--color-border, #344143);
  padding-top: 10px;
}

.section-title-row {
  margin-bottom: 8px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-muted, #98A6A1);
}

.regular-frames-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.frame-thumb-card {
  background: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  border-radius: 4px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.frame-thumb-card:hover {
  border-color: var(--color-muted, #98A6A1);
}

.frame-thumb-card.active {
  border-color: var(--color-accent, #B9F36B);
  background: var(--color-surface-raised, #20282A);
}

.frame-card-img {
  max-width: 44px;
  max-height: 44px;
  image-rendering: pixelated;
  object-fit: contain;
}

.frame-card-label {
  font-size: 9px;
  font-family: monospace;
  color: var(--color-muted, #98A6A1);
}

.slices-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.slice-item {
  background-color: var(--color-canvas, #101416);
  border: 1px solid var(--color-border, #344143);
  padding: 4px;
  border-radius: 3px;
  text-align: center;
}

.slice-id {
  display: block;
  font-size: 9px;
  color: var(--color-accent, #B9F36B);
  font-family: monospace;
}

.slice-dims {
  font-size: 8px;
  color: #72827e;
  font-family: monospace;
}

.more-hint {
  font-size: 10px;
  color: var(--color-muted, #98A6A1);
  margin-top: 6px;
}
</style>
