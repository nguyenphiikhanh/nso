<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AssetInspector from './components/AssetInspector.vue'
import AssetLibrary from './components/AssetLibrary.vue'
import MapCanvas from './components/MapCanvas.vue'
import SpritePreview from './components/SpritePreview.vue'
import SourceLibrary from './components/SourceLibrary.vue'
import SpriteEditor from './components/SpriteEditor.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import { fetchDatabaseStatus, uploadPng } from './services/project.api'
import { assetKindLabels, type AssetKind, type GameAsset, type GameMap, type GameProject, type SourceAsset } from './types/project'
import { useProject } from './composables/useProject'

const { project, saveState, errorMessage, saveNow } = useProject()
const activeMode = ref<AssetKind | 'map' | 'source'>('map')
const selectedMapId = ref<string | null>(null)
const selectedAssetId = ref<string | null>(null)
const brushTileId = ref<string | null>(null)
const erasing = ref(false)
const zoom = ref(1)
const uploadBusy = ref(false)
const uploadError = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const sourceAsset = ref<SourceAsset | null>(null)
const databaseConnected = ref(false)
const databaseMessage = ref('')
const sourceSaveBusy = ref(false)
const sourceCount = ref(0)
const map = computed(() => project.value?.maps.find((item) => item.id === selectedMapId.value) ?? project.value?.maps[0] ?? null)
const asset = computed(() => project.value?.assets.find((item) => item.id === selectedAssetId.value) ?? null)
const tiles = computed(() => project.value?.assets.filter((item) => item.kind === 'tile') ?? [])
const counts = computed(() => ({
  map: project.value?.maps.length ?? 0,
  tile: project.value?.assets.filter((item) => item.kind === 'tile').length ?? 0,
  item: project.value?.assets.filter((item) => item.kind === 'item').length ?? 0,
  character: project.value?.assets.filter((item) => item.kind === 'character').length ?? 0,
  outfit: project.value?.assets.filter((item) => item.kind === 'outfit').length ?? 0,
  mount: project.value?.assets.filter((item) => item.kind === 'mount').length ?? 0,
  source: sourceCount.value,
}))
const modeTitle = computed(() => activeMode.value === 'map' ? 'World maps' : activeMode.value === 'source' ? 'Data gốc' : assetKindLabels[activeMode.value])
const saveLabel = computed(() => ({ loading: 'Đang mở project', saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Lỗi lưu' })[saveState.value])

watch(project, (value) => {
  if (!value) return
  if (!selectedMapId.value || !value.maps.some((entry) => entry.id === selectedMapId.value)) selectedMapId.value = value.maps[0]?.id ?? null
  if (!brushTileId.value || !value.assets.some((entry) => entry.id === brushTileId.value && entry.kind === 'tile')) brushTileId.value = value.assets.find((entry) => entry.kind === 'tile')?.id ?? null
}, { deep: true })

function changeMode(mode: AssetKind | 'map' | 'source') {
  activeMode.value = mode
  if (mode !== 'source') sourceAsset.value = null
  if (mode !== 'map') {
    if (mode !== 'source') {
      const candidate = project.value?.assets.find((entry) => entry.kind === mode)
      selectedAssetId.value = candidate?.id ?? null
    }
  }
}

function newMap() {
  if (!project.value) return
  const index = project.value.maps.length + 1
  const width = 24
  const height = 14
  const mapEntry: GameMap = {
    id: `map-${crypto.randomUUID().slice(0, 8)}`,
    name: `Map mới ${index}`,
    width,
    height,
    tileSize: 32,
    tiles: Array(width * height).fill(null),
  }
  project.value.maps.push(mapEntry)
  selectedMapId.value = mapEntry.id
}

function defaultProperties(kind: AssetKind): GameAsset['properties'] {
  if (kind === 'tile') return { terrain: 'Ground', collision: false, swatch: '#7b9665' }
  if (kind === 'item') return { itemType: 'Consumable', rarity: 'Common', stackSize: 99 }
  if (kind === 'character') return { role: 'NPC', level: 1, hp: 100 }
  if (kind === 'outfit') return { slot: 'Body', defense: 0 }
  return { speed: 100, jump: 1 }
}

function newAsset() {
  if (!project.value || activeMode.value === 'map') return newMap()
  if (activeMode.value === 'source') return
  const kind = activeMode.value
  const serial = project.value.assets.filter((entry) => entry.kind === kind).length + 1
  const entry: GameAsset = {
    id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
    name: `${assetKindLabels[kind]} mới ${serial}`,
    kind,
    imageUrl: null,
    description: '',
    properties: defaultProperties(kind),
  }
  project.value.assets.push(entry)
  selectedAssetId.value = entry.id
  if (kind === 'tile' && !brushTileId.value) brushTileId.value = entry.id
}

function updateAsset(field: string, value: string | number | boolean) {
  if (!asset.value) return
  if (field === 'name') asset.value.name = String(value)
  if (field === 'description') asset.value.description = String(value)
}

function updateProperty(field: string, value: string | number | boolean) {
  if (asset.value) asset.value.properties[field] = value
}

function resizeMap(mapEntry: GameMap, width: number, height: number) {
  const nextWidth = Math.min(128, Math.max(4, Math.round(width)))
  const nextHeight = Math.min(128, Math.max(4, Math.round(height)))
  const resized = Array<string | null>(nextWidth * nextHeight).fill(null)
  for (let row = 0; row < Math.min(mapEntry.height, nextHeight); row += 1) {
    for (let col = 0; col < Math.min(mapEntry.width, nextWidth); col += 1) {
      resized[row * nextWidth + col] = mapEntry.tiles[row * mapEntry.width + col] ?? null
    }
  }
  mapEntry.width = nextWidth
  mapEntry.height = nextHeight
  mapEntry.tiles = resized
}

function updateMap(field: 'name' | 'width' | 'height' | 'tileSize', value: string | number) {
  if (!map.value) return
  if (field === 'name') map.value.name = String(value)
  if (field === 'width') resizeMap(map.value, Number(value), map.value.height)
  if (field === 'height') resizeMap(map.value, map.value.width, Number(value))
  if (field === 'tileSize') map.value.tileSize = Math.min(128, Math.max(8, Math.round(Number(value) / 8) * 8))
}

function paintTile(index: number, tileId: string | null) {
  if (map.value) map.value.tiles[index] = tileId
}

function removeMap() {
  if (!project.value || !map.value) return
  if (!window.confirm(`Xóa map “${map.value.name}” khỏi project?`)) return
  project.value.maps = project.value.maps.filter((entry) => entry.id !== map.value?.id)
  selectedMapId.value = project.value.maps[0]?.id ?? null
}

async function handleUpload(file: File) {
  if (!asset.value) return
  uploadBusy.value = true
  uploadError.value = ''
  try {
    const result = await uploadPng(file)
    asset.value.imageUrl = result.imageUrl
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Không thể tải ảnh lên.'
  } finally {
    uploadBusy.value = false
  }
}

async function saveSourceAsAsset(file: File, name: string, source: SourceAsset) {
  if (!project.value || !sourceAsset.value) return
  sourceSaveBusy.value = true
  try {
    const result = await uploadPng(file)
    const kind: AssetKind = source.group === 'Map' ? 'tile' : source.group === 'Mob' ? 'character' : source.group === 'Effect' || source.group === 'EffectAuto' ? 'item' : 'item'
    const saved: GameAsset = {
      id: `asset-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim().slice(0, 64) || source.name,
      kind,
      imageUrl: result.imageUrl,
      description: `Bản chỉnh từ Data/Img/${source.relativePath}`,
      properties: { sourceGroup: source.group, sourcePath: source.relativePath },
    }
    project.value.assets.push(saved)
    selectedAssetId.value = saved.id
    sourceSaveBusy.value = false
    changeMode(kind)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Không lưu được sprite vào project.')
  } finally {
    sourceSaveBusy.value = false
  }
}

function removeAsset() {
  if (!project.value || !asset.value) return
  const selected = asset.value
  if (!window.confirm(`Xóa “${selected.name}” khỏi project?`)) return
  project.value.assets = project.value.assets.filter((entry) => entry.id !== selected.id)
  if (selected.kind === 'tile') {
    for (const mapEntry of project.value.maps) {
      mapEntry.tiles = mapEntry.tiles.map((tileId) => tileId === selected.id ? null : tileId)
    }
    if (brushTileId.value === selected.id) brushTileId.value = tiles.value.find((entry) => entry.id !== selected.id)?.id ?? null
  }
  selectedAssetId.value = project.value.assets.find((entry) => entry.kind === activeMode.value)?.id ?? null
}

function exportJson() {
  if (!project.value) return
  const blob = new Blob([`${JSON.stringify(project.value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.value.name.trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'game-project'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function importJson() {
  importInput.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !project.value) return
  try {
    const parsed = JSON.parse(await file.text()) as GameProject
    if (parsed.version !== 1 || typeof parsed.name !== 'string' || !Array.isArray(parsed.assets) || !Array.isArray(parsed.maps)) {
      throw new Error('File không đúng định dạng project của Game Asset Studio.')
    }
    if (parsed.maps.some((entry) => !Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.tiles?.length !== entry.width * entry.height)) {
      throw new Error('Một map trong file có kích thước hoặc dữ liệu tile không hợp lệ.')
    }
    const shouldReplace = window.confirm('Nạp project JSON này và thay dữ liệu đang mở?')
    if (!shouldReplace) return
    project.value = parsed
    selectedMapId.value = parsed.maps[0]?.id ?? null
    selectedAssetId.value = null
    brushTileId.value = parsed.assets.find((entry) => entry.kind === 'tile')?.id ?? null
    activeMode.value = 'map'
    await saveNow()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Không thể đọc project JSON.')
  } finally {
    input.value = ''
  }
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.matches('input, textarea, select, [contenteditable="true"]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveNow()
  } else if (event.key.toLowerCase() === 'e' && activeMode.value === 'map') {
    erasing.value = true
  } else if (event.key.toLowerCase() === 'b' && activeMode.value === 'map') {
    erasing.value = false
  } else if (event.key === 'Escape') {
    erasing.value = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
onMounted(async () => {
  try {
    const status = await fetchDatabaseStatus()
    databaseConnected.value = status.connected
    databaseMessage.value = status.message || ''
  } catch { databaseConnected.value = false; databaseMessage.value = 'Không kiểm tra được MariaDB.' }
})
</script>

<template>
  <main v-if="project" class="studio-shell">
    <header class="topbar">
      <div class="brand-lockup"><span class="brand-symbol"><i /><i /><i /></span><span class="brand-name">GAME<span>STUDIO</span></span></div>
      <span class="topbar-divider" />
      <label class="project-name"><span>PROJECT</span><input v-model="project.name" aria-label="Tên project" /></label>
      <span class="save-indicator" :class="`save-${saveState}`"><i />{{ saveLabel }}</span>
      <div class="topbar-actions">
        <input ref="importInput" class="visually-hidden" type="file" accept="application/json,.json" @change="handleImport" />
        <button class="top-action secondary-button" type="button" @click="importJson"><span aria-hidden="true">↥</span> Import JSON</button>
        <button class="top-action secondary-button" type="button" @click="exportJson"><span aria-hidden="true">↧</span> Export JSON</button>
        <button class="top-action save-button" type="button" :disabled="saveState === 'saving' || saveState === 'loading'" @click="saveNow"><span aria-hidden="true">⌘</span> Lưu project</button>
      </div>
    </header>

    <div class="work-area">
      <WorkspaceSidebar :active="activeMode" :counts="counts" @select="changeMode" />
      <SourceLibrary v-if="activeMode === 'source'" :selected-id="sourceAsset?.id ?? null" @select="(entry) => (sourceAsset = entry)" @total="(count) => (sourceCount = count)" />
      <AssetLibrary v-else
        :mode="activeMode"
        :assets="project.assets"
        :maps="project.maps"
        :selected-asset-id="selectedAssetId"
        :selected-map-id="map?.id ?? null"
        :brush-tile-id="brushTileId"
        @add="newAsset"
        @select-asset="(id) => id ? (selectedAssetId = id) : changeMode('tile')"
        @select-map="(id) => (selectedMapId = id)"
        @select-brush="(id) => { brushTileId = id; erasing = false }"
      />

      <section class="editor-workspace">
        <template v-if="activeMode === 'source' && sourceAsset">
          <div class="editor-header source-editor-header">
            <div class="editor-title"><span class="breadcrumb">DATA / {{ sourceAsset.group.toUpperCase() }} / {{ sourceAsset.variant }}</span><h1>{{ sourceAsset.name }}</h1><span class="scene-tag">SPRITE</span></div>
            <div class="editor-stats"><span><b>{{ databaseConnected ? 'DB CONNECTED' : 'PNG ONLY' }}</b><small>METADATA</small></span></div>
          </div>
          <SpriteEditor :key="sourceAsset.id" :source="sourceAsset" :database-connected="databaseConnected" :database-message="databaseMessage" :saving="sourceSaveBusy" @save="saveSourceAsAsset" />
          <footer class="editor-statusbar"><span><i class="status-dot" /> SOURCE SPRITE</span><span>ORIGINAL <b>Data/Img/{{ sourceAsset.relativePath }}</b></span><span>READ ONLY SOURCE</span></footer>
        </template>
        <template v-if="activeMode === 'map' && map">
          <div class="editor-header">
            <div class="editor-title"><span class="breadcrumb">WORLD / SCENES</span><h1>{{ map.name }}</h1><span class="scene-tag">SCENE</span></div>
            <div class="editor-stats"><span><b>{{ map.width }} × {{ map.height }}</b><small>GRID</small></span><i /><span><b>{{ map.tileSize }} px</b><small>TILE SIZE</small></span></div>
          </div>
          <div class="editor-toolbar">
            <div class="tool-group">
              <button class="tool-button" :class="{ chosen: !erasing }" type="button" title="Bút (B)" @click="erasing = false"><span class="tool-icon pen-icon">╱</span><span>Bút</span><kbd>B</kbd></button>
              <button class="tool-button" :class="{ chosen: erasing }" type="button" title="Tẩy (E)" @click="erasing = true"><span class="tool-icon eraser-icon">◩</span><span>Tẩy</span><kbd>E</kbd></button>
            </div>
            <div class="toolbar-spacer" />
            <span class="active-tile-label"><i :style="{ background: erasing ? '#5e6968' : String(tiles.find((entry) => entry.id === brushTileId)?.properties.swatch || '#6f9f62') }" />{{ erasing ? 'Tẩy ô' : tiles.find((entry) => entry.id === brushTileId)?.name || 'Chọn tile' }}</span>
            <span class="toolbar-divider" />
            <button class="zoom-button" type="button" aria-label="Thu nhỏ" @click="zoom = Math.max(0.5, Number((zoom - 0.25).toFixed(2)))">−</button>
            <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
            <button class="zoom-button" type="button" aria-label="Phóng to" @click="zoom = Math.min(2, Number((zoom + 0.25).toFixed(2)))">+</button>
            <button class="fit-button" type="button" @click="zoom = 1">Đặt lại</button>
          </div>
          <div class="canvas-scroll-area">
            <div class="canvas-coordinate coordinate-top">0&nbsp;&nbsp; 1&nbsp;&nbsp; 2&nbsp;&nbsp; 3&nbsp;&nbsp; 4&nbsp;&nbsp; 5</div>
            <MapCanvas :map="map" :tiles="tiles" :brush-tile-id="brushTileId" :erasing="erasing" :zoom="zoom" @paint="paintTile" />
            <div class="canvas-caption"><span><i class="legend-cursor" />{{ erasing ? 'Click hoặc kéo để xóa tile' : 'Click hoặc kéo để đặt tile' }}</span><span>{{ map.width * map.tileSize }} × {{ map.height * map.tileSize }} px</span></div>
          </div>
          <footer class="editor-statusbar"><span><i class="status-dot" /> CANVAS READY</span><span>PROJECT FILE <b>project.json</b></span><span>LOCAL WORKSPACE</span></footer>
        </template>
        <template v-else-if="activeMode !== 'map' && asset">
          <div class="editor-header">
            <div class="editor-title"><span class="breadcrumb">ASSETS / {{ asset.kind.toUpperCase() }}</span><h1>{{ asset.name }}</h1><span class="scene-tag">{{ asset.kind.toUpperCase() }}</span></div>
            <div class="editor-stats"><span><b>{{ asset.imageUrl ? 'PNG READY' : 'NO SPRITE' }}</b><small>PREVIEW</small></span></div>
          </div>
          <SpritePreview :asset="asset" />
          <footer class="editor-statusbar"><span><i class="status-dot" /> ASSET READY</span><span>ASSET ID <b>{{ asset.id }}</b></span><span>LOCAL WORKSPACE</span></footer>
        </template>
        <div v-else-if="activeMode !== 'source'" class="editor-empty">
          <span class="empty-outline">＋</span>
          <h1>{{ modeTitle }}</h1>
          <p>Tạo asset đầu tiên để bắt đầu xây dựng game.</p>
          <button class="save-button" type="button" @click="newAsset">+ Thêm {{ activeMode === 'map' ? 'map' : assetKindLabels[activeMode].toLowerCase() }}</button>
        </div>
      </section>

      <aside v-if="activeMode === 'source'" class="inspector-panel source-inspector">
        <header class="inspector-heading"><div><span class="eyebrow">SOURCE DATA</span><h2>Sprite details</h2></div></header>
        <template v-if="sourceAsset">
          <section class="inspector-section"><div class="section-title"><span class="section-number">01</span><h3>File gốc</h3></div>
            <div class="metric-row"><span>Nhóm</span><strong>{{ sourceAsset.group }}</strong></div><div class="metric-row"><span>Biến thể</span><strong>{{ sourceAsset.variant }}</strong></div>
            <label class="field-label">Đường dẫn<input :value="sourceAsset.relativePath" readonly class="mono-input" /></label>
          </section>
          <section class="inspector-section"><div class="section-title"><span class="section-number">02</span><h3>Chỉnh sprite</h3></div><p class="source-help">Dùng bút/tẩy trên canvas; lưu thành PNG mới trong project. File gốc trong Data/Img được giữ nguyên.</p></section>
          <div class="inspector-tip"><span class="tip-mark">i</span><span>Data/Img có thể duyệt trực tiếp. Metadata crop/animation đọc từ MariaDB nếu container đang chạy.</span></div>
        </template>
        <div v-else class="inspector-empty"><strong>Chọn một sprite</strong><span>PNG gốc sẽ hiện ở đây để preview và chỉnh.</span></div>
      </aside>
      <AssetInspector v-else
        :mode="activeMode"
        :asset="activeMode === 'map' ? null : asset"
        :map="activeMode === 'map' ? map : null"
        :upload-busy="uploadBusy"
        :error-message="uploadError || (saveState === 'error' ? errorMessage : '')"
        @update-asset="updateAsset"
        @update-property="updateProperty"
        @update-map="updateMap"
        @upload="handleUpload"
        @delete="removeAsset"
        @delete-map="removeMap"
      />
    </div>
  </main>
  <main v-else class="loading-screen">
    <div class="loading-mark">G</div>
    <strong>{{ saveState === 'error' ? 'Không thể mở project' : 'Đang mở workspace' }}</strong>
    <span>{{ saveState === 'error' ? errorMessage : 'Đang đọc project.json…' }}</span>
  </main>
</template>
