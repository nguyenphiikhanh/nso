<script setup lang="ts">
import { computed, ref } from 'vue'
import { assetKindLabels, type AssetKind, type GameAsset, type GameMap } from '../types/project'

const props = defineProps<{
  mode: AssetKind | 'map'
  assets: GameAsset[]
  maps: GameMap[]
  selectedAssetId: string | null
  selectedMapId: string | null
  brushTileId: string | null
}>()

const emit = defineEmits<{
  add: []
  selectAsset: [id: string]
  selectMap: [id: string]
  selectBrush: [id: string]
}>()

const query = ref('')
const isMapMode = computed(() => props.mode === 'map')
const modeAssets = computed(() => props.assets.filter((asset) => asset.kind === (props.mode === 'map' ? 'tile' : props.mode)))
const filteredAssets = computed(() => modeAssets.value.filter((asset) => asset.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const title = computed(() => isMapMode.value ? 'Bản đồ' : assetKindLabels[props.mode as AssetKind])
</script>

<template>
  <aside class="library-panel">
    <header class="panel-heading">
      <div>
        <span class="eyebrow">PROJECT LIBRARY</span>
        <h2>{{ title }}</h2>
      </div>
      <button class="icon-button add-button" type="button" :aria-label="isMapMode ? 'Tạo map' : `Tạo ${title.toLowerCase()}`" title="Thêm mới" @click="emit('add')">+</button>
    </header>

    <template v-if="isMapMode">
      <div class="library-section-head">
        <span>SCENES <b>{{ maps.length.toString().padStart(2, '0') }}</b></span>
        <button class="text-button" type="button" @click="emit('add')">Tạo map</button>
      </div>
      <div class="scene-list">
        <button v-for="map in maps" :key="map.id" class="scene-row" :class="{ selected: map.id === selectedMapId }" type="button" @click="emit('selectMap', map.id)">
          <span class="scene-thumb"><i /><i /><i /></span>
          <span class="scene-copy"><strong>{{ map.name }}</strong><small>{{ map.width }} × {{ map.height }} tiles</small></span>
          <span class="row-dot" />
        </button>
      </div>
      <div class="library-section-head tile-section-head">
        <span>TILE PALETTE <b>{{ modeAssets.length.toString().padStart(2, '0') }}</b></span>
        <button class="text-button" type="button" @click="emit('selectAsset', '')">Quản lý</button>
      </div>
      <div class="tile-palette">
        <button v-for="asset in modeAssets" :key="asset.id" class="tile-choice" :class="{ selected: asset.id === brushTileId }" type="button" :title="asset.name" @click="emit('selectBrush', asset.id)">
          <span class="tile-swatch" :style="{ '--swatch': String(asset.properties.swatch || '#647a67') }">
            <img v-if="asset.imageUrl" :src="asset.imageUrl" :alt="asset.name" />
          </span>
          <span class="tile-name">{{ asset.name }}</span>
          <span v-if="asset.id === brushTileId" class="tile-active" aria-label="Tile đang chọn">●</span>
        </button>
        <button v-if="modeAssets.length === 0" class="empty-inline" type="button" @click="emit('add')">+ Thêm tile đầu tiên</button>
      </div>
      <div class="library-footnote"><span class="keycap">B</span> Chọn tile <span class="keycap">E</span> Tẩy</div>
    </template>

    <template v-else>
      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <input v-model="query" type="search" :placeholder="`Tìm ${title.toLowerCase()}...`" />
        <span class="keycap">/</span>
      </label>
      <div class="library-section-head asset-section-head">
        <span>ASSETS <b>{{ filteredAssets.length.toString().padStart(2, '0') }}</b></span>
        <button class="text-button" type="button" @click="emit('add')">+ Mới</button>
      </div>
      <div class="asset-list">
        <button v-for="asset in filteredAssets" :key="asset.id" class="asset-row" :class="{ selected: asset.id === selectedAssetId }" type="button" @click="emit('selectAsset', asset.id)">
          <span class="asset-thumb checkerboard">
            <img v-if="asset.imageUrl" :src="asset.imageUrl" :alt="asset.name" />
            <span v-else class="asset-monogram">{{ asset.name.slice(0, 1).toLocaleUpperCase() }}</span>
          </span>
          <span class="asset-copy"><strong>{{ asset.name }}</strong><small>{{ asset.id }}</small></span>
          <span class="asset-kind-mark">{{ asset.kind.slice(0, 2).toUpperCase() }}</span>
        </button>
        <div v-if="filteredAssets.length === 0" class="empty-library">
          <span class="empty-glyph">＋</span>
          <strong>Chưa có {{ title.toLowerCase() }}</strong>
          <span>Thêm asset hoặc kéo ảnh PNG vào inspector.</span>
          <button class="secondary-button" type="button" @click="emit('add')">Tạo {{ title.toLowerCase() }}</button>
        </div>
      </div>
      <div class="library-footnote">Lưu trong project JSON <span class="separator-dot">·</span> PNG ở thư mục assets</div>
    </template>
  </aside>
</template>
