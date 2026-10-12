<script setup lang="ts">
import { assetKindLabels, propertyDefinitions, type AssetKind, type GameAsset, type GameMap } from '../types/project'

const props = defineProps<{
  mode: AssetKind | 'map'
  asset: GameAsset | null
  map: GameMap | null
  uploadBusy: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  updateAsset: [field: string, value: string | number | boolean]
  updateProperty: [field: string, value: string | number | boolean]
  updateMap: [field: 'name' | 'width' | 'height' | 'tileSize', value: string | number]
  upload: [file: File]
  delete: []
  deleteMap: []
}>()

function propertyValue(key: string) {
  return props.asset?.properties[key]
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', file)
  input.value = ''
}

function numberValue(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <aside class="inspector-panel">
    <header class="inspector-heading">
      <div>
        <span class="eyebrow">INSPECTOR</span>
        <h2>{{ mode === 'map' ? 'Map settings' : assetKindLabels[mode] }}</h2>
      </div>
      <button v-if="mode !== 'map' && asset" class="icon-button danger-quiet" type="button" title="Xóa asset" aria-label="Xóa asset" @click="emit('delete')">×</button>
      <button v-if="mode === 'map' && map" class="icon-button danger-quiet" type="button" title="Xóa map" aria-label="Xóa map" @click="emit('deleteMap')">×</button>
    </header>

    <template v-if="mode === 'map' && map">
      <section class="inspector-section">
        <div class="section-title"><span class="section-number">01</span><h3>Thông tin scene</h3></div>
        <label class="field-label">Tên map<input :value="map.name" type="text" maxlength="64" @input="emit('updateMap', 'name', ($event.target as HTMLInputElement).value)" /></label>
        <div class="field-grid">
          <label class="field-label">Chiều rộng<input :value="map.width" type="number" min="4" max="128" @change="emit('updateMap', 'width', numberValue($event))" /></label>
          <label class="field-label">Chiều cao<input :value="map.height" type="number" min="4" max="128" @change="emit('updateMap', 'height', numberValue($event))" /></label>
        </div>
        <label class="field-label">Kích thước tile<input :value="map.tileSize" type="number" min="8" max="128" step="8" @change="emit('updateMap', 'tileSize', numberValue($event))" /></label>
      </section>
      <section class="inspector-section compact-section">
        <div class="section-title"><span class="section-number">02</span><h3>Kích thước canvas</h3></div>
        <div class="metric-row"><span>Tổng số ô</span><strong>{{ map.width * map.height }}</strong></div>
        <div class="metric-row"><span>Kích thước xuất</span><strong>{{ map.width * map.tileSize }} × {{ map.height * map.tileSize }} px</strong></div>
      </section>
      <div class="inspector-tip"><span class="tip-mark">i</span><span>Kéo chuột trên canvas để tô. Dùng công cụ tẩy để xóa ô đã chọn.</span></div>
    </template>

    <template v-else-if="asset">
      <section class="sprite-section">
        <div class="section-title"><span class="section-number">01</span><h3>Sprite preview</h3></div>
        <label class="sprite-drop checkerboard" :class="{ uploading: uploadBusy }">
          <img v-if="asset.imageUrl" :src="asset.imageUrl" :alt="asset.name" />
          <span v-else class="sprite-empty"><b>{{ asset.name.slice(0, 1).toLocaleUpperCase() }}</b><small>PNG preview</small></span>
          <span v-if="uploadBusy" class="upload-overlay">Đang tải ảnh…</span>
          <input type="file" accept="image/png,.png" :disabled="uploadBusy" @change="handleFile" />
          <span class="replace-image">{{ asset.imageUrl ? 'Thay ảnh PNG' : 'Import ảnh PNG' }}</span>
        </label>
        <div class="image-meta"><span>PNG · tối đa 10 MB</span><span>Nearest neighbor</span></div>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      </section>

      <section class="inspector-section">
        <div class="section-title"><span class="section-number">02</span><h3>Asset details</h3></div>
        <label class="field-label">Tên<input :value="asset.name" type="text" maxlength="64" @input="emit('updateAsset', 'name', ($event.target as HTMLInputElement).value)" /></label>
        <label class="field-label">ID <span class="field-hint">không đổi</span><input :value="asset.id" type="text" disabled class="mono-input" /></label>
        <label class="field-label">Mô tả<textarea :value="asset.description" rows="3" maxlength="280" placeholder="Mô tả ngắn về asset" @input="emit('updateAsset', 'description', ($event.target as HTMLTextAreaElement).value)" /></label>
      </section>

      <section class="inspector-section property-section">
        <div class="section-title"><span class="section-number">03</span><h3>Thuộc tính</h3></div>
        <label v-for="field in propertyDefinitions[asset.kind]" :key="field.key" class="field-label property-field">
          {{ field.label }}
          <input
            v-if="field.type !== 'boolean'"
            :value="propertyValue(field.key) ?? ''"
            :type="field.type"
            :step="field.type === 'number' ? 1 : undefined"
            @input="emit('updateProperty', field.key, field.type === 'number' ? numberValue($event) : ($event.target as HTMLInputElement).value)"
          />
          <span v-else class="toggle-row"><span>{{ propertyValue(field.key) ? 'Có' : 'Không' }}</span><input type="checkbox" :checked="Boolean(propertyValue(field.key))" @change="emit('updateProperty', field.key, ($event.target as HTMLInputElement).checked)" /></span>
        </label>
      </section>
      <div class="asset-path"><span class="path-dot" /> {{ asset.imageUrl ? 'Ảnh đã lưu trong project/assets' : 'Chưa gắn ảnh' }}</div>
    </template>

    <div v-else class="inspector-empty">
      <span class="empty-outline">＋</span>
      <strong>Chọn một asset</strong>
      <span>Thông tin và thuộc tính sẽ hiện ở đây.</span>
    </div>
  </aside>
</template>
