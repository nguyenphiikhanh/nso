<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { NsoMapSummary, NsoMapDetail, NsoNpcSpawn, NsoWaypointSpawn, NsoMonsterSpawn } from '../types/nso'
import { fetchAllMaps, fetchMapDetail, saveMapDraft } from '../services/nso.api'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

const maps = ref<NsoMapSummary[]>([])
const selectedMapId = ref<number>(1)
const currentMap = ref<NsoMapDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const filterQuery = ref('')

// Tools
type ToolMode = 'brush' | 'picker' | 'eraser' | 'npc' | 'waypoint' | 'monster'
const currentTool = ref<ToolMode>('brush')
const activeTileIndex = ref<number>(1)
const zoom = ref<number>(1)
const tilesetImage = ref<HTMLImageElement | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)

// Tileset dimensions (24x24 per tile)
const TILE_SIZE = 24
const tilesetCols = ref(10)
const totalTilesetTiles = ref(100)

const filteredMaps = computed(() => {
  if (!filterQuery.value.trim()) return maps.value
  const q = filterQuery.value.trim().toLowerCase()
  return maps.value.filter(
    (m) => String(m.id).includes(q) || m.name.toLowerCase().includes(q)
  )
})

async function loadMapList() {
  try {
    maps.value = await fetchAllMaps()
  } catch (err) {
    console.error('Lỗi tải danh sách map:', err)
  }
}

async function selectMap(id: number) {
  selectedMapId.value = id
  loading.value = true
  try {
    currentMap.value = await fetchMapDetail(id)
    loadTilesetImage(currentMap.value.tileId)
    loadBgImage(currentMap.value.bgId)
  } catch (err) {
    console.error(`Lỗi tải chi tiết map ${id}:`, err)
  } finally {
    loading.value = false
  }
}

function loadTilesetImage(tileId: number) {
  const img = new Image()
  img.src = `/source-media/Map/4/tile/${tileId}.png`
  img.onload = () => {
    tilesetImage.value = img
    tilesetCols.value = Math.max(1, Math.floor(img.width / TILE_SIZE))
    const rows = Math.max(1, Math.floor(img.height / TILE_SIZE))
    totalTilesetTiles.value = tilesetCols.value * rows
  }
  img.onerror = () => {
    // Fallback thử thư mục zoom khác
    img.src = `/source-media/Map/2/tile/${tileId}.png`
  }
}

function loadBgImage(bgId: number) {
  const img = new Image()
  img.src = `/source-media/Map/4/bg/${bgId}.png`
  img.onload = () => {
    bgImage.value = img
  }
}

function onTileClick(x: number, y: number) {
  if (!currentMap.value || !currentMap.value.tiles) return
  const index = y * currentMap.value.tmw + x

  if (currentTool.value === 'brush') {
    currentMap.value.tiles[index] = activeTileIndex.value
  } else if (currentTool.value === 'eraser') {
    currentMap.value.tiles[index] = 0
  } else if (currentTool.value === 'picker') {
    activeTileIndex.value = currentMap.value.tiles[index] || 0
    currentTool.value = 'brush'
  } else if (currentTool.value === 'npc') {
    currentMap.value.npc.push({
      x: x * TILE_SIZE,
      y: y * TILE_SIZE,
      templateId: 1,
      status: 1,
    })
  } else if (currentTool.value === 'waypoint') {
    currentMap.value.waypoint.push({
      next: 2,
      minX: x * TILE_SIZE,
      minY: y * TILE_SIZE,
      maxX: (x + 2) * TILE_SIZE,
      maxY: (y + 2) * TILE_SIZE,
      x: 50,
      y: 200,
    })
  } else if (currentTool.value === 'monster') {
    currentMap.value.monster.push({
      x: x * TILE_SIZE,
      y: y * TILE_SIZE,
      templateId: 1,
      boss: false,
    })
  }
}

async function saveCurrentDraft() {
  if (!currentMap.value) return
  saving.value = true
  try {
    await saveMapDraft(currentMap.value.id, currentMap.value)
    currentMap.value.isDraft = true
    const found = maps.value.find((m) => m.id === currentMap.value!.id)
    if (found) found.isDraft = true
    emit('draft-updated')
  } catch (err) {
    console.error('Lỗi lưu nháp map:', err)
  } finally {
    saving.value = false
  }
}

function removeNpc(index: number) {
  currentMap.value?.npc.splice(index, 1)
}

function removeWaypoint(index: number) {
  currentMap.value?.waypoint.splice(index, 1)
}

function removeMonster(index: number) {
  currentMap.value?.monster.splice(index, 1)
}

onMounted(() => {
  loadMapList().then(() => {
    if (maps.value.length > 0) {
      selectMap(maps.value[0].id)
    }
  })
})
</script>

<template>
  <div class="map-studio">
    <!-- Left Rail: Danh sách Map NSO -->
    <aside class="map-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Danh sách Map NSO</span>
        <span class="map-badge">{{ maps.length }} map</span>
      </div>
      <div class="search-box">
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Tìm ID hoặc tên map..."
          class="input-search"
        />
      </div>
      <div class="map-list">
        <button
          v-for="m in filteredMaps"
          :key="m.id"
          class="map-item"
          :class="{ active: m.id === selectedMapId, 'is-draft': m.isDraft }"
          @click="selectMap(m.id)"
        >
          <div class="map-item-info">
            <span class="map-id">#{{ m.id }}</span>
            <span class="map-name">{{ m.name }}</span>
          </div>
          <span v-if="m.isDraft" class="draft-dot" title="Có bản nháp chưa lưu">Nháp</span>
        </button>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="map-viewport">
      <!-- Toolbar -->
      <div class="map-toolbar">
        <div class="tool-group">
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'brush' }"
            @click="currentTool = 'brush'"
            title="Bút vẽ Tile (B)"
          >
            ✏️ Bút vẽ
          </button>
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'eraser' }"
            @click="currentTool = 'eraser'"
            title="Tẩy Tile (E)"
          >
            🧹 Tẩy
          </button>
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'picker' }"
            @click="currentTool = 'picker'"
            title="Hút Tile"
          >
            💉 Hút Tile
          </button>
        </div>

        <div class="tool-group entity-tools">
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'npc' }"
            @click="currentTool = 'npc'"
            title="Click lên map để đặt NPC"
          >
            👤 Đặt NPC
          </button>
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'waypoint' }"
            @click="currentTool = 'waypoint'"
            title="Click lên map để tạo Cổng dịch chuyển"
          >
            🌀 Cổng map
          </button>
          <button
            class="tool-btn"
            :class="{ active: currentTool === 'monster' }"
            @click="currentTool = 'monster'"
            title="Click lên map để tạo điểm Spawn Quái"
          >
            👾 Spawn Quái
          </button>
        </div>

        <div class="tool-group zoom-group">
          <span class="tool-label">Zoom:</span>
          <button
            v-for="z in [1, 2, 3, 4]"
            :key="z"
            class="zoom-btn"
            :class="{ active: zoom === z }"
            @click="zoom = z"
          >
            {{ z }}x
          </button>
        </div>

        <div class="action-right">
          <button
            class="btn-save-draft"
            :disabled="saving || !currentMap"
            @click="saveCurrentDraft"
          >
            {{ saving ? 'Đang lưu nháp...' : '💾 Lưu Bản Nháp' }}
          </button>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="canvas-scroll-container">
        <div v-if="loading" class="loading-overlay">Đang tải dữ liệu map...</div>
        <div
          v-else-if="currentMap"
          class="map-canvas-stage"
          :style="{
            width: `${currentMap.tmw * TILE_SIZE * zoom}px`,
            height: `${currentMap.tmh * TILE_SIZE * zoom}px`,
          }"
        >
          <!-- Grid Tiles -->
          <div
            class="tile-grid"
            :style="{
              gridTemplateColumns: `repeat(${currentMap.tmw}, ${TILE_SIZE * zoom}px)`,
              gridTemplateRows: `repeat(${currentMap.tmh}, ${TILE_SIZE * zoom}px)`,
            }"
          >
            <div
              v-for="(tileVal, idx) in currentMap.tiles"
              :key="idx"
              class="tile-cell"
              :style="{
                width: `${TILE_SIZE * zoom}px`,
                height: `${TILE_SIZE * zoom}px`,
              }"
              @click="onTileClick(idx % currentMap.tmw, Math.floor(idx / currentMap.tmw))"
            >
              <div
                v-if="tileVal > 0 && tilesetImage"
                class="tile-graphic"
                :style="{
                  width: `${TILE_SIZE * zoom}px`,
                  height: `${TILE_SIZE * zoom}px`,
                  backgroundImage: `url(${tilesetImage.src})`,
                  backgroundSize: `${tilesetImage.width * zoom}px ${tilesetImage.height * zoom}px`,
                  backgroundPosition: `-${((tileVal % tilesetCols) * TILE_SIZE) * zoom}px -${(Math.floor(tileVal / tilesetCols) * TILE_SIZE) * zoom}px`,
                }"
              />
            </div>
          </div>

          <!-- Overlays: Waypoints -->
          <div
            v-for="(wp, wIdx) in currentMap.waypoint"
            :key="`wp-${wIdx}`"
            class="entity-waypoint"
            :style="{
              left: `${wp.minX * zoom}px`,
              top: `${wp.minY * zoom}px`,
              width: `${Math.max(TILE_SIZE, (wp.maxX - wp.minX)) * zoom}px`,
              height: `${Math.max(TILE_SIZE, (wp.maxY - wp.minY)) * zoom}px`,
            }"
            :title="`Cổng chuyển Map -> Map #${wp.next}`"
          >
            <span class="wp-tag">➡️ #{{ wp.next }}</span>
          </div>

          <!-- Overlays: NPCs -->
          <div
            v-for="(npc, nIdx) in currentMap.npc"
            :key="`npc-${nIdx}`"
            class="entity-npc"
            :style="{
              left: `${npc.x * zoom}px`,
              top: `${npc.y * zoom}px`,
            }"
            :title="`NPC Template #${npc.templateId}`"
          >
            👤
          </div>

          <!-- Overlays: Monsters -->
          <div
            v-for="(mob, mIdx) in currentMap.monster"
            :key="`mob-${mIdx}`"
            class="entity-mob"
            :style="{
              left: `${mob.x * zoom}px`,
              top: `${mob.y * zoom}px`,
            }"
            :title="`Quái #${mob.templateId} ${mob.boss ? '(BOSS)' : ''}`"
          >
            👾
          </div>
        </div>
      </div>
    </main>

    <!-- Right Inspector: Thuộc tính Map & Tileset Picker -->
    <aside class="map-inspector" v-if="currentMap">
      <div class="inspector-header">
        <span class="inspector-title">Thuộc tính Map #{{ currentMap.id }}</span>
      </div>

      <div class="inspector-body">
        <div class="form-group">
          <label>Tên Map:</label>
          <input v-model="currentMap.name" type="text" class="input-text" />
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Rộng (tmw):</label>
            <input v-model.number="currentMap.tmw" type="number" class="input-text" disabled />
          </div>
          <div class="form-group half">
            <label>Cao (tmh):</label>
            <input v-model.number="currentMap.tmh" type="number" class="input-text" disabled />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Tileset ID:</label>
            <input
              v-model.number="currentMap.tileId"
              type="number"
              class="input-text"
              @change="loadTilesetImage(currentMap.tileId)"
            />
          </div>
          <div class="form-group half">
            <label>Background ID:</label>
            <input
              v-model.number="currentMap.bgId"
              type="number"
              class="input-text"
              @change="loadBgImage(currentMap.bgId)"
            />
          </div>
        </div>

        <!-- Bảng chọn Tile từ Tileset -->
        <div class="tileset-picker-section">
          <label class="section-label">Bảng chọn Tile (Đang chọn: #{{ activeTileIndex }}):</label>
          <div class="tileset-grid-container" v-if="tilesetImage">
            <div
              v-for="tIndex in Math.min(60, totalTilesetTiles)"
              :key="tIndex"
              class="tileset-sample"
              :class="{ selected: activeTileIndex === tIndex }"
              @click="activeTileIndex = tIndex; currentTool = 'brush'"
            >
              <div
                class="tileset-sample-thumb"
                :style="{
                  width: `${TILE_SIZE}px`,
                  height: `${TILE_SIZE}px`,
                  backgroundImage: `url(${tilesetImage.src})`,
                  backgroundPosition: `-${(tIndex % tilesetCols) * TILE_SIZE}px -${Math.floor(tIndex / tilesetCols) * TILE_SIZE}px`,
                }"
              />
              <span class="sample-id">{{ tIndex }}</span>
            </div>
          </div>
        </div>

        <!-- Entity lists -->
        <div class="entities-section">
          <label class="section-label">NPC trên Map ({{ currentMap.npc.length }}):</label>
          <div class="entity-list-items">
            <div v-for="(npc, idx) in currentMap.npc" :key="idx" class="entity-row">
              <span>NPC #{{ npc.templateId }} ({{ npc.x }}, {{ npc.y }})</span>
              <button class="btn-del" @click="removeNpc(idx)">✕</button>
            </div>
          </div>

          <label class="section-label">Cổng chuyển Map ({{ currentMap.waypoint.length }}):</label>
          <div class="entity-list-items">
            <div v-for="(wp, idx) in currentMap.waypoint" :key="idx" class="entity-row">
              <span>➡️ Map #{{ wp.next }}</span>
              <button class="btn-del" @click="removeWaypoint(idx)">✕</button>
            </div>
          </div>

          <label class="section-label">Điểm Spawn Quái ({{ currentMap.monster.length }}):</label>
          <div class="entity-list-items">
            <div v-for="(mob, idx) in currentMap.monster" :key="idx" class="entity-row">
              <span>👾 Mob #{{ mob.templateId }} ({{ mob.x }}, {{ mob.y }})</span>
              <button class="btn-del" @click="removeMonster(idx)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.map-studio {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--color-canvas, #101416);
  color: var(--color-text, #E9EFEB);
}

.map-sidebar {
  width: 260px;
  border-right: 1px solid var(--color-border, #344143);
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface, #171D1F);
}

.sidebar-header {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border, #344143);
}

.sidebar-title {
  font-weight: 600;
  font-size: 13px;
}

.map-badge {
  font-size: 10px;
  background-color: #293A21;
  color: #B9F36B;
  padding: 2px 6px;
  border-radius: 4px;
}

.search-box {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border, #344143);
}

.input-search {
  width: 100%;
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid var(--color-border, #344143);
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
}

.map-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.map-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #98A6A1;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.map-item:hover {
  background-color: #20282A;
  color: #E9EFEB;
}

.map-item.active {
  background-color: #293A21;
  color: #B9F36B;
  font-weight: 600;
}

.map-id {
  font-family: monospace;
  margin-right: 6px;
  color: #72827e;
}

.draft-dot {
  font-size: 9px;
  background: #F1A773;
  color: #18210F;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.map-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #0c0f11;
}

.map-toolbar {
  height: 48px;
  border-bottom: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}

.tool-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tool-btn {
  padding: 6px 10px;
  background-color: #20282A;
  border: 1px solid var(--color-border, #344143);
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.tool-btn:hover {
  background-color: #293335;
}

.tool-btn.active {
  background-color: #B9F36B;
  color: #18210F;
  border-color: #B9F36B;
  font-weight: 600;
}

.zoom-group {
  margin-left: 8px;
}

.tool-label {
  font-size: 11px;
  color: #98A6A1;
  margin-right: 4px;
}

.zoom-btn {
  padding: 4px 6px;
  background: #20282A;
  border: 1px solid #344143;
  color: #98A6A1;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.zoom-btn.active {
  background: #293A21;
  color: #B9F36B;
  border-color: #B9F36B;
}

.action-right {
  margin-left: auto;
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

.btn-save-draft:hover {
  filter: brightness(1.1);
}

.canvas-scroll-container {
  flex: 1;
  overflow: auto;
  position: relative;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.map-canvas-stage {
  position: relative;
  box-shadow: 0 0 20px rgba(0,0,0,0.6);
  image-rendering: pixelated;
  user-select: none;
  background-color: #151a1d;
}

.tile-grid {
  display: grid;
  position: absolute;
  top: 0;
  left: 0;
}

.tile-cell {
  position: relative;
  border: 1px solid rgba(255,255,255,0.04);
  box-sizing: border-box;
}

.tile-cell:hover {
  outline: 1px solid #B9F36B;
  z-index: 5;
}

.tile-graphic {
  image-rendering: pixelated;
}

.entity-waypoint {
  position: absolute;
  background-color: rgba(0, 180, 216, 0.35);
  border: 1px dashed #00b4d8;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.wp-tag {
  font-size: 10px;
  background-color: #0077b6;
  color: white;
  padding: 1px 3px;
  border-radius: 2px;
}

.entity-npc {
  position: absolute;
  font-size: 16px;
  transform: translate(-50%, -100%);
  z-index: 11;
  text-shadow: 0 1px 3px black;
  cursor: pointer;
}

.entity-mob {
  position: absolute;
  font-size: 16px;
  transform: translate(-50%, -100%);
  z-index: 11;
  text-shadow: 0 1px 3px black;
  cursor: pointer;
}

.map-inspector {
  width: 280px;
  border-left: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.inspector-header {
  padding: 12px;
  border-bottom: 1px solid #344143;
}

.inspector-title {
  font-weight: 600;
  font-size: 13px;
}

.inspector-body {
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

.tileset-picker-section {
  margin-top: 8px;
  border-top: 1px solid #344143;
  padding-top: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #98A6A1;
  margin-bottom: 6px;
  display: block;
}

.tileset-grid-container {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  padding: 4px;
  background-color: #101416;
  border-radius: 4px;
}

.tileset-sample {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}

.tileset-sample:hover {
  background-color: #20282A;
}

.tileset-sample.selected {
  border-color: #B9F36B;
  background-color: #293A21;
}

.sample-id {
  font-size: 9px;
  color: #72827e;
  margin-top: 2px;
}

.entities-section {
  margin-top: 8px;
  border-top: 1px solid #344143;
  padding-top: 8px;
}

.entity-list-items {
  max-height: 100px;
  overflow-y: auto;
  margin-bottom: 8px;
}

.entity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  font-size: 11px;
  color: #cbd5e1;
  border-radius: 3px;
}

.entity-row:hover {
  background-color: #20282A;
}

.btn-del {
  background: transparent;
  border: none;
  color: #EF7772;
  cursor: pointer;
}
</style>
