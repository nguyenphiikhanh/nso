<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type { NsoMapSummary, NsoMapDetail } from '../types/nso'
import { fetchAllMaps, fetchMapDetail, saveMapDraft } from '../services/nso.api'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

// Constants
const TILE_LOGIC_SIZE = 24 // 24x24 px logic trong NSO
const TILE_SOURCE_SIZE = 96 // 96x96 px nguồn HD từ Data/Img/Map/4/tile/

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
const mapCanvasRef = ref<HTMLCanvasElement | null>(null)

// Mouse & Hover state
const isMouseDown = ref(false)
const hoverTile = ref<{ col: number; row: number; val: number } | null>(null)

// Layer Visibility Toggles (Option B: Full 6 Layers)
const showBg = ref(true)
const showBehind = ref(true)
const showTiles = ref(true)
const showBetwen = ref(true)
const showEntities = ref(true)
const showFront = ref(true)
const showGrid = ref(true)

// Asset Images Cache
const tilesetImage = ref<HTMLImageElement | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)
const objectImages = new Map<number, HTMLImageElement>()
const totalTilesetTiles = ref(120)

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
    const detail = await fetchMapDetail(id)
    currentMap.value = detail

    // Preload toàn bộ assets: Tileset HD, Background, Object cây cối/nhà cửa
    await Promise.all([
      loadTilesetImage(detail.tileId),
      loadBgImage(detail.bgId),
      preloadMapObjects(detail),
    ])

    await nextTick()
    renderMapCanvas()
  } catch (err) {
    console.error(`Lỗi tải chi tiết map ${id}:`, err)
  } finally {
    loading.value = false
  }
}

function loadTilesetImage(tileId: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/source-media/Map/4/tile/${tileId}.png`
    img.onload = () => {
      tilesetImage.value = img
      totalTilesetTiles.value = Math.max(1, Math.floor(img.naturalHeight / TILE_SOURCE_SIZE))
      resolve()
    }
    img.onerror = () => {
      // Fallback nếu thiếu thư mục 4
      img.src = `/source-media/Map/1/tile/${tileId}.png`
      img.onload = () => {
        tilesetImage.value = img
        totalTilesetTiles.value = Math.max(1, Math.floor(img.naturalHeight / 24))
        resolve()
      }
      img.onerror = () => resolve()
    }
  })
}

function loadBgImage(bgId: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/source-media/Map/4/bg/${bgId}.png`
    img.onload = () => {
      bgImage.value = img
      resolve()
    }
    img.onerror = () => {
      // Fallback về nền 0
      img.src = `/source-media/Map/4/bg/0.png`
      img.onload = () => {
        bgImage.value = img
        resolve()
      }
      img.onerror = () => {
        bgImage.value = null
        resolve()
      }
    }
  })
}

function loadSingleObjectImage(id: number): Promise<HTMLImageElement | null> {
  if (objectImages.has(id)) {
    return Promise.resolve(objectImages.get(id)!)
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/source-media/Object/4/${id}.png`
    img.onload = () => {
      objectImages.set(id, img)
      resolve(img)
    }
    img.onerror = () => {
      resolve(null)
    }
  })
}

async function preloadMapObjects(map: NsoMapDetail) {
  const ids = new Set<number>()
  if (Array.isArray(map.behind)) map.behind.forEach((o) => ids.add(o.id))
  if (Array.isArray(map.betwen)) map.betwen.forEach((o) => ids.add(o.id))
  if (Array.isArray(map.front)) map.front.forEach((o) => ids.add(o.id))

  await Promise.all(Array.from(ids).map((id) => loadSingleObjectImage(id)))
}

// ==================== MULTI-LAYER CANVAS ENGINE ====================
function renderMapCanvas() {
  const canvas = mapCanvasRef.value
  if (!canvas || !currentMap.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const z = zoom.value
  const tmw = currentMap.value.tmw
  const tmh = currentMap.value.tmh
  const renderTileSize = TILE_LOGIC_SIZE * z
  const fullWidth = tmw * renderTileSize
  const fullHeight = tmh * renderTileSize

  if (canvas.width !== fullWidth || canvas.height !== fullHeight) {
    canvas.width = fullWidth
    canvas.height = fullHeight
  }

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, fullWidth, fullHeight)

  // 1. Layer 0: Background
  if (showBg.value && bgImage.value && bgImage.value.naturalWidth > 0) {
    const bg = bgImage.value
    const bgW = bg.naturalWidth * z
    const bgH = bg.naturalHeight * z
    for (let bx = 0; bx < fullWidth; bx += bgW) {
      ctx.drawImage(bg, bx, 0, bgW, Math.min(fullHeight, bgH))
    }
  } else {
    ctx.fillStyle = '#101416'
    ctx.fillRect(0, 0, fullWidth, fullHeight)
  }

  // 2. Layer 1: Behind Objects (Cây cối, kiến trúc lớp sau)
  if (showBehind.value && Array.isArray(currentMap.value.behind)) {
    for (const obj of currentMap.value.behind) {
      const img = objectImages.get(obj.id)
      if (img && img.naturalWidth > 0) {
        // Object/4 có độ phân giải 4x so với tile 24px
        const objW = (img.naturalWidth / 4) * z
        const objH = (img.naturalHeight / 4) * z
        const ox = obj.x * renderTileSize
        const oy = obj.y * renderTileSize
        ctx.drawImage(img, ox, oy, objW, objH)
      }
    }
  }

  // 3. Layer 2: Terrain Tiles (Địa hình gạch chính chuẩn NSO)
  if (showTiles.value && tilesetImage.value && Array.isArray(currentMap.value.tiles)) {
    const ts = tilesetImage.value
    const tiles = currentMap.value.tiles
    for (let r = 0; r < tmh; r++) {
      for (let c = 0; c < tmw; c++) {
        const val = tiles[r * tmw + c]
        if (val > 0) {
          // Tileset NSO là dải ảnh dọc 1 cột duy nhất: x = 0, y = (val - 1) * TILE_SOURCE_SIZE
          const srcX = 0
          const srcY = (val - 1) * TILE_SOURCE_SIZE
          const destX = c * renderTileSize
          const destY = r * renderTileSize
          ctx.drawImage(
            ts,
            srcX,
            srcY,
            TILE_SOURCE_SIZE,
            TILE_SOURCE_SIZE,
            destX,
            destY,
            renderTileSize,
            renderTileSize
          )
        }
      }
    }
  }

  // 4. Layer 3: Betwen Objects (Vật thể lớp giữa)
  if (showBetwen.value && Array.isArray(currentMap.value.betwen)) {
    for (const obj of currentMap.value.betwen) {
      const img = objectImages.get(obj.id)
      if (img && img.naturalWidth > 0) {
        const objW = (img.naturalWidth / 4) * z
        const objH = (img.naturalHeight / 4) * z
        const ox = obj.x * renderTileSize
        const oy = obj.y * renderTileSize
        ctx.drawImage(img, ox, oy, objW, objH)
      }
    }
  }

  // 5. Layer 4: Entities (NPCs, Quái vật, Cổng chuyển map)
  if (showEntities.value) {
    // 5a. Waypoints
    if (Array.isArray(currentMap.value.waypoint)) {
      for (const wp of currentMap.value.waypoint) {
        const wx = wp.minX * z
        const wy = wp.minY * z
        const ww = Math.max(renderTileSize, (wp.maxX - wp.minX) * z)
        const wh = Math.max(renderTileSize, (wp.maxY - wp.minY) * z)

        ctx.fillStyle = 'rgba(185, 243, 107, 0.22)'
        ctx.fillRect(wx, wy, ww, wh)
        ctx.strokeStyle = '#B9F36B'
        ctx.lineWidth = 1.5
        ctx.strokeRect(wx, wy, ww, wh)

        ctx.font = 'bold 10px monospace'
        const label = `🌀 Map #${wp.next}`
        const textW = ctx.measureText(label).width + 6
        ctx.fillStyle = 'rgba(16, 20, 22, 0.85)'
        ctx.fillRect(wx, Math.max(0, wy - 14), textW, 14)
        ctx.fillStyle = '#B9F36B'
        ctx.fillText(label, wx + 3, Math.max(10, wy - 3))
      }
    }

    // 5b. NPCs
    if (Array.isArray(currentMap.value.npc)) {
      for (const npc of currentMap.value.npc) {
        const nx = npc.x * z
        const ny = npc.y * z

        ctx.beginPath()
        ctx.arc(nx, ny, 6 * z, 0, Math.PI * 2)
        ctx.fillStyle = '#F1A773'
        ctx.fill()
        ctx.strokeStyle = '#101416'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.font = '10px monospace'
        const label = `👤 #${npc.templateId}`
        ctx.fillStyle = 'rgba(16, 20, 22, 0.8)'
        ctx.fillRect(nx - 12, ny - 16 * z, ctx.measureText(label).width + 4, 12)
        ctx.fillStyle = '#F1A773'
        ctx.fillText(label, nx - 10, ny - 7 * z)
      }
    }

    // 5c. Monsters
    if (Array.isArray(currentMap.value.monster)) {
      for (const mob of currentMap.value.monster) {
        const mx = mob.x * z
        const my = mob.y * z

        ctx.beginPath()
        ctx.arc(mx, my, mob.boss ? 8 * z : 5 * z, 0, Math.PI * 2)
        ctx.fillStyle = mob.boss ? '#EF7772' : 'rgba(239, 119, 114, 0.8)'
        ctx.fill()
        ctx.strokeStyle = '#101416'
        ctx.lineWidth = 1.5
        ctx.stroke()

        if (mob.boss) {
          ctx.font = 'bold 10px monospace'
          ctx.fillStyle = '#EF7772'
          ctx.fillText(`👑 #${mob.templateId}`, mx - 14, my - 10 * z)
        }
      }
    }
  }

  // 6. Layer 5: Front Objects (Tiền cảnh che phía trước)
  if (showFront.value && Array.isArray(currentMap.value.front)) {
    for (const obj of currentMap.value.front) {
      const img = objectImages.get(obj.id)
      if (img && img.naturalWidth > 0) {
        const objW = (img.naturalWidth / 4) * z
        const objH = (img.naturalHeight / 4) * z
        const ox = obj.x * renderTileSize
        const oy = obj.y * renderTileSize
        ctx.drawImage(img, ox, oy, objW, objH)
      }
    }
  }

  // 7. Grid Overlay
  if (showGrid.value) {
    ctx.strokeStyle = 'rgba(52, 65, 67, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= fullWidth; x += renderTileSize) {
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, fullHeight)
    }
    for (let y = 0; y <= fullHeight; y += renderTileSize) {
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(fullWidth, y + 0.5)
    }
    ctx.stroke()
  }

  // 8. Hover Highlight
  if (hoverTile.value) {
    const hx = hoverTile.value.col * renderTileSize
    const hy = hoverTile.value.row * renderTileSize
    ctx.strokeStyle = '#B9F36B'
    ctx.lineWidth = 2
    ctx.strokeRect(hx, hy, renderTileSize, renderTileSize)
    ctx.fillStyle = 'rgba(185, 243, 107, 0.18)'
    ctx.fillRect(hx, hy, renderTileSize, renderTileSize)
  }
}

// Watchers for reactivity
watch(
  [zoom, showBg, showBehind, showTiles, showBetwen, showEntities, showFront, showGrid],
  () => {
    renderMapCanvas()
  }
)

// Canvas Event Handlers
function getTileCoordFromEvent(e: MouseEvent): { col: number; row: number } | null {
  if (!currentMap.value || !mapCanvasRef.value) return null
  const rect = mapCanvasRef.value.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top
  const tileSize = TILE_LOGIC_SIZE * zoom.value
  const col = Math.floor(clickX / tileSize)
  const row = Math.floor(clickY / tileSize)
  if (col >= 0 && col < currentMap.value.tmw && row >= 0 && row < currentMap.value.tmh) {
    return { col, row }
  }
  return null
}

function applyToolAt(col: number, row: number) {
  if (!currentMap.value || !currentMap.value.tiles) return
  const index = row * currentMap.value.tmw + col

  if (currentTool.value === 'brush') {
    if (currentMap.value.tiles[index] !== activeTileIndex.value) {
      currentMap.value.tiles[index] = activeTileIndex.value
      currentMap.value.isDraft = true
    }
  } else if (currentTool.value === 'eraser') {
    if (currentMap.value.tiles[index] !== 0) {
      currentMap.value.tiles[index] = 0
      currentMap.value.isDraft = true
    }
  } else if (currentTool.value === 'picker') {
    activeTileIndex.value = currentMap.value.tiles[index] || 1
    currentTool.value = 'brush'
  } else if (currentTool.value === 'npc') {
    currentMap.value.npc.push({
      x: col * TILE_LOGIC_SIZE,
      y: row * TILE_LOGIC_SIZE,
      templateId: 1,
      status: 1,
    })
    currentMap.value.isDraft = true
    currentTool.value = 'brush'
  } else if (currentTool.value === 'waypoint') {
    currentMap.value.waypoint.push({
      next: 2,
      minX: col * TILE_LOGIC_SIZE,
      minY: row * TILE_LOGIC_SIZE,
      maxX: (col + 2) * TILE_LOGIC_SIZE,
      maxY: (row + 2) * TILE_LOGIC_SIZE,
      x: 50,
      y: 200,
    })
    currentMap.value.isDraft = true
    currentTool.value = 'brush'
  } else if (currentTool.value === 'monster') {
    currentMap.value.monster.push({
      x: col * TILE_LOGIC_SIZE,
      y: row * TILE_LOGIC_SIZE,
      templateId: 1,
      boss: false,
    })
    currentMap.value.isDraft = true
    currentTool.value = 'brush'
  }
}

function handleCanvasMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isMouseDown.value = true
  const coord = getTileCoordFromEvent(e)
  if (coord) {
    applyToolAt(coord.col, coord.row)
    renderMapCanvas()
  }
}

function handleCanvasMouseMove(e: MouseEvent) {
  const coord = getTileCoordFromEvent(e)
  if (coord && currentMap.value) {
    const idx = coord.row * currentMap.value.tmw + coord.col
    hoverTile.value = {
      col: coord.col,
      row: coord.row,
      val: currentMap.value.tiles?.[idx] || 0,
    }
    if (isMouseDown.value && (currentTool.value === 'brush' || currentTool.value === 'eraser')) {
      applyToolAt(coord.col, coord.row)
    }
    renderMapCanvas()
  } else {
    if (hoverTile.value) {
      hoverTile.value = null
      renderMapCanvas()
    }
  }
}

function handleCanvasMouseUp() {
  isMouseDown.value = false
}

function handleCanvasMouseLeave() {
  isMouseDown.value = false
  if (hoverTile.value) {
    hoverTile.value = null
    renderMapCanvas()
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
  if (currentMap.value?.npc) {
    currentMap.value.npc.splice(index, 1)
    renderMapCanvas()
  }
}

function removeWaypoint(index: number) {
  if (currentMap.value?.waypoint) {
    currentMap.value.waypoint.splice(index, 1)
    renderMapCanvas()
  }
}

function removeMonster(index: number) {
  if (currentMap.value?.monster) {
    currentMap.value.monster.splice(index, 1)
    renderMapCanvas()
  }
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
      <!-- Toolbar Row 1: Editing Tools & Zoom -->
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

        <!-- Live Cursor Tile Info -->
        <div v-if="hoverTile" class="hover-info-badge">
          <span>Col: {{ hoverTile.col }}, Row: {{ hoverTile.row }} ({{ hoverTile.col * 24 }}, {{ hoverTile.row * 24 }}px)</span>
          <span class="badge-tile-val">Tile: #{{ hoverTile.val }}</span>
        </div>

        <div class="action-right">
          <button
            class="btn-save-draft"
            :disabled="saving || !currentMap"
            @click="saveCurrentDraft"
          >
            {{ saving ? 'Đang lưu...' : '💾 Lưu Bản Nháp' }}
          </button>
        </div>
      </div>

      <!-- Toolbar Row 2: Layer Visibility Strip (Option B) -->
      <div class="map-layers-strip">
        <span class="layers-label">Lớp hiển thị (Layers):</span>
        <label class="layer-pill" :class="{ active: showBg }">
          <input v-model="showBg" type="checkbox" />
          <span>🌄 Nền (bg)</span>
        </label>
        <label class="layer-pill" :class="{ active: showBehind }">
          <input v-model="showBehind" type="checkbox" />
          <span>🌲 Cây sau (behind: {{ currentMap?.behind?.length || 0 }})</span>
        </label>
        <label class="layer-pill" :class="{ active: showTiles }">
          <input v-model="showTiles" type="checkbox" />
          <span>🧱 Địa hình (tiles: {{ currentMap?.tiles?.length || 0 }})</span>
        </label>
        <label class="layer-pill" :class="{ active: showBetwen }">
          <input v-model="showBetwen" type="checkbox" />
          <span>🎋 Cây giữa (betwen: {{ currentMap?.betwen?.length || 0 }})</span>
        </label>
        <label class="layer-pill" :class="{ active: showEntities }">
          <input v-model="showEntities" type="checkbox" />
          <span>👾 Thực thể (NPC/Quái/Cổng)</span>
        </label>
        <label class="layer-pill" :class="{ active: showFront }">
          <input v-model="showFront" type="checkbox" />
          <span>🍃 Tiền cảnh (front: {{ currentMap?.front?.length || 0 }})</span>
        </label>
        <label class="layer-pill" :class="{ active: showGrid }">
          <input v-model="showGrid" type="checkbox" />
          <span>📐 Ô lưới (grid)</span>
        </label>
      </div>

      <!-- Canvas Scroll Area -->
      <div class="canvas-scroll-container">
        <div v-if="loading" class="loading-overlay">
          ⏳ Đang tải bản đồ & đồng bộ ảnh...
        </div>
        <div v-show="!loading" class="canvas-stage-wrapper">
          <canvas
            ref="mapCanvasRef"
            class="map-render-canvas"
            @mousedown="handleCanvasMouseDown"
            @mousemove="handleCanvasMouseMove"
            @mouseup="handleCanvasMouseUp"
            @mouseleave="handleCanvasMouseLeave"
          />
        </div>
      </div>
    </main>

    <!-- Right Inspector: Thuộc tính Map & Tileset Picker -->
    <aside v-if="currentMap" class="map-inspector">
      <div class="inspector-header">
        <span class="inspector-title">Bản đồ #{{ currentMap.id }}: {{ currentMap.name }}</span>
      </div>

      <div class="inspector-body">
        <div class="form-group">
          <label>Tên Map:</label>
          <input v-model="currentMap.name" type="text" class="input-text" />
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Số ô ngang (tmw):</label>
            <input v-model.number="currentMap.tmw" type="number" class="input-text" disabled />
          </div>
          <div class="form-group half">
            <label>Số ô dọc (tmh):</label>
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
              @change="loadTilesetImage(currentMap.tileId).then(renderMapCanvas)"
            />
          </div>
          <div class="form-group half">
            <label>Background ID:</label>
            <input
              v-model.number="currentMap.bgId"
              type="number"
              class="input-text"
              @change="loadBgImage(currentMap.bgId).then(renderMapCanvas)"
            />
          </div>
        </div>

        <!-- Bảng chọn Tile từ Tileset (Dải ảnh 1 cột chuẩn) -->
        <div class="tileset-picker-section">
          <div class="picker-header-row">
            <label class="section-label">Kho Tile (Chọn: #{{ activeTileIndex }}):</label>
            <span class="tile-count-badge">{{ totalTilesetTiles }} tiles</span>
          </div>

          <div v-if="tilesetImage" class="tileset-grid-container">
            <div
              v-for="tIndex in Math.min(120, totalTilesetTiles)"
              :key="tIndex"
              class="tileset-sample"
              :class="{ selected: activeTileIndex === tIndex }"
              @click="activeTileIndex = tIndex; currentTool = 'brush'"
              :title="`Tile #${tIndex}`"
            >
              <div
                class="tileset-sample-thumb"
                :style="{
                  width: '28px',
                  height: '28px',
                  backgroundImage: `url(${tilesetImage.src})`,
                  backgroundSize: '28px auto',
                  backgroundPosition: `0px -${(tIndex - 1) * 28}px`,
                }"
              />
              <span class="sample-id">#{{ tIndex }}</span>
            </div>
          </div>
        </div>

        <!-- Entity lists -->
        <div class="entities-section">
          <label class="section-label">NPC trên Map ({{ currentMap.npc?.length || 0 }}):</label>
          <div class="entity-list-items">
            <div v-for="(npc, idx) in currentMap.npc" :key="idx" class="entity-row">
              <span>👤 NPC #{{ npc.templateId }} ({{ npc.x }}, {{ npc.y }})</span>
              <button class="btn-del" @click="removeNpc(idx)">✕</button>
            </div>
          </div>

          <label class="section-label">Cổng chuyển Map ({{ currentMap.waypoint?.length || 0 }}):</label>
          <div class="entity-list-items">
            <div v-for="(wp, idx) in currentMap.waypoint" :key="idx" class="entity-row">
              <span>🌀 Sang Map #{{ wp.next }}</span>
              <button class="btn-del" @click="removeWaypoint(idx)">✕</button>
            </div>
          </div>

          <label class="section-label">Điểm Spawn Quái ({{ currentMap.monster?.length || 0 }}):</label>
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
  color: var(--color-text, #e9efeb);
}

.map-sidebar {
  width: 250px;
  border-right: 1px solid var(--color-border, #344143);
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface, #171d1f);
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
  background-color: #293a21;
  color: #b9f36b;
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
  color: #e9efeb;
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
  color: #98a6a1;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.map-item:hover {
  background-color: #20282a;
  color: #e9efeb;
}

.map-item.active {
  background-color: #293a21;
  color: #b9f36b;
  font-weight: 600;
}

.map-id {
  font-family: monospace;
  margin-right: 6px;
  color: #72827e;
}

.draft-dot {
  font-size: 9px;
  background: #f1a773;
  color: #18210f;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.map-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #0b0e10;
}

.map-toolbar {
  height: 44px;
  border-bottom: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171d1f);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
}

.map-layers-strip {
  padding: 6px 14px;
  background-color: #121719;
  border-bottom: 1px solid #283335;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.layers-label {
  font-size: 11px;
  font-weight: 600;
  color: #8fa0a5;
  margin-right: 4px;
}

.layer-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background-color: #1a2225;
  border: 1px solid #344143;
  color: #98a6a1;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.layer-pill:hover {
  color: #e9efeb;
  border-color: #4a5c60;
}

.layer-pill.active {
  background-color: #24331e;
  border-color: #b9f36b;
  color: #b9f36b;
}

.layer-pill input {
  accent-color: #b9f36b;
  margin: 0;
  cursor: pointer;
}

.tool-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tool-btn {
  padding: 5px 9px;
  background-color: #20282a;
  border: 1px solid var(--color-border, #344143);
  color: #e9efeb;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.tool-btn:hover {
  background-color: #293335;
}

.tool-btn.active {
  background-color: #b9f36b;
  color: #18210f;
  border-color: #b9f36b;
  font-weight: 700;
}

.zoom-group {
  margin-left: 6px;
}

.tool-label {
  font-size: 11px;
  color: #98a6a1;
  margin-right: 3px;
}

.zoom-btn {
  padding: 3px 6px;
  background: #20282a;
  border: 1px solid #344143;
  color: #98a6a1;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.zoom-btn.active {
  background: #293a21;
  color: #b9f36b;
  border-color: #b9f36b;
}

.hover-info-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #101416;
  border: 1px solid #344143;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 10px;
  color: #98a6a1;
}

.badge-tile-val {
  color: #b9f36b;
  font-weight: 700;
}

.action-right {
  margin-left: auto;
}

.btn-save-draft {
  padding: 6px 14px;
  background-color: #b9f36b;
  color: #18210f;
  border: none;
  border-radius: 4px;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-save-draft:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.3);
}

.btn-save-draft:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.canvas-scroll-container {
  flex: 1;
  overflow: auto;
  position: relative;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #080a0b;
}

.loading-overlay {
  padding: 20px;
  font-size: 13px;
  color: #f1a773;
}

.canvas-stage-wrapper {
  position: relative;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.8);
  border: 1px solid #344143;
  line-height: 0;
}

.map-render-canvas {
  display: block;
  image-rendering: pixelated;
  cursor: crosshair;
}

.map-inspector {
  width: 280px;
  border-left: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171d1f);
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
  font-size: 12px;
  color: #e9efeb;
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
  color: #98a6a1;
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
  color: #e9efeb;
  border-radius: 4px;
  font-size: 11px;
}

.tileset-picker-section {
  margin-top: 6px;
  border-top: 1px solid #344143;
  padding-top: 8px;
}

.picker-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #98a6a1;
  display: block;
}

.tile-count-badge {
  font-size: 10px;
  color: #b9f36b;
  font-family: monospace;
}

.tileset-grid-container {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 6px;
  background-color: #101416;
  border-radius: 4px;
  border: 1px solid #283335;
}

.tileset-sample {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.tileset-sample:hover {
  background-color: #20282a;
}

.tileset-sample.selected {
  border-color: #b9f36b;
  background-color: #293a21;
}

.tileset-sample-thumb {
  image-rendering: pixelated;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sample-id {
  font-size: 9px;
  color: #72827e;
  margin-top: 2px;
  font-family: monospace;
}

.entities-section {
  margin-top: 6px;
  border-top: 1px solid #344143;
  padding-top: 8px;
}

.entity-list-items {
  max-height: 100px;
  overflow-y: auto;
  margin-bottom: 8px;
  background-color: #101416;
  border-radius: 4px;
  padding: 4px;
  border: 1px solid #283335;
}

.entity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  font-size: 10px;
  color: #cbd5e1;
  border-radius: 3px;
}

.entity-row:hover {
  background-color: #20282a;
}

.btn-del {
  background: transparent;
  border: none;
  color: #ef7772;
  cursor: pointer;
  font-weight: 700;
  padding: 0 4px;
}

.btn-del:hover {
  color: #f87171;
}
</style>
