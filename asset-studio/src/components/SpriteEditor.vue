<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { fetchSpriteMetadata } from '../services/project.api'
import type { SourceAsset, SpriteMetadata } from '../types/project'

const props = defineProps<{ source: SourceAsset; databaseConnected: boolean; databaseMessage: string; saving: boolean }>()
const emit = defineEmits<{ save: [file: File, name: string, source: SourceAsset] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const frameCanvas = ref<HTMLCanvasElement | null>(null)
const tool = ref<'pencil' | 'eraser'>('pencil')
const color = ref('#e7f3cd')
const brushSize = ref(1)
const zoom = ref(4)
const showGrid = ref(true)
const dirty = ref(false)
const busy = ref(true)
const problem = ref('')
const metadata = ref<SpriteMetadata | null>(null)
const selectedFrame = ref(0)
const assetName = ref(props.source.name)
const dimensions = ref({ width: 0, height: 0 })
const frames = computed(() => metadata.value?.sprites || [])
const chosenFrame = computed(() => frames.value[selectedFrame.value] || null)
const frameSequence = computed(() => metadata.value?.sequence || metadata.value?.running || [])
let image: HTMLImageElement | null = null
let undoStack: ImageData[] = []
let redoStack: ImageData[] = []
let drawing = false

const canUndo = computed(() => undoStack.length > 0)
const canRedo = computed(() => redoStack.length > 0)

function context() {
  return canvas.value?.getContext('2d', { willReadFrequently: true }) || null
}

function remember() {
  const ctx = context()
  if (!ctx || !canvas.value) return
  undoStack.push(ctx.getImageData(0, 0, canvas.value.width, canvas.value.height))
  if (undoStack.length > 20) undoStack.shift()
  redoStack = []
}

function paint(event: PointerEvent) {
  if (!drawing || !canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / bounds.width
  const scaleY = canvas.value.height / bounds.height
  const x = Math.floor((event.clientX - bounds.left) * scaleX)
  const y = Math.floor((event.clientY - bounds.top) * scaleY)
  const ctx = context()
  if (!ctx || x < 0 || y < 0 || x >= canvas.value.width || y >= canvas.value.height) return
  const size = Math.max(1, brushSize.value)
  if (tool.value === 'eraser') ctx.clearRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size)
  else {
    ctx.fillStyle = color.value
    ctx.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size)
  }
  dirty.value = true
}

function pointerDown(event: PointerEvent) {
  if (!canvas.value) return
  remember()
  drawing = true
  canvas.value.setPointerCapture(event.pointerId)
  paint(event)
}

function pointerUp() { drawing = false }

function undo() {
  const ctx = context()
  const target = undoStack.pop()
  if (!ctx || !canvas.value || !target) return
  redoStack.push(ctx.getImageData(0, 0, canvas.value.width, canvas.value.height))
  ctx.putImageData(target, 0, 0)
  dirty.value = true
}

function redo() {
  const ctx = context()
  const target = redoStack.pop()
  if (!ctx || !canvas.value || !target) return
  undoStack.push(ctx.getImageData(0, 0, canvas.value.width, canvas.value.height))
  ctx.putImageData(target, 0, 0)
  dirty.value = true
}

async function loadSource() {
  busy.value = true
  problem.value = ''
  metadata.value = null
  selectedFrame.value = 0
  dirty.value = false
  undoStack = []
  redoStack = []
  assetName.value = props.source.name
  image = new Image()
  image.onload = async () => {
    if (!canvas.value || !image) return
    if (image.naturalWidth > 4096 || image.naturalHeight > 4096) {
      problem.value = 'Ảnh lớn hơn giới hạn chỉnh sửa 4096 × 4096 px.'
      busy.value = false
      return
    }
    dimensions.value = { width: image.naturalWidth, height: image.naturalHeight }
    canvas.value.width = image.naturalWidth
    canvas.value.height = image.naturalHeight
    const ctx = context()
    if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0) }
    await loadMetadata()
    busy.value = false
  }
  image.onerror = () => { problem.value = 'Không tải được ảnh nguồn.'; busy.value = false }
  image.src = props.source.url
}

async function loadMetadata() {
  if (!['Mob', 'Effect', 'EffectAuto'].includes(props.source.group)) return
  const numericId = props.source.name.match(/^\d+/)?.[0]
  if (!numericId) return
  try { metadata.value = await fetchSpriteMetadata(props.source.group, numericId) } catch { metadata.value = null }
  await nextTick()
  drawSelectedFrame()
}

function drawSelectedFrame() {
  const target = frameCanvas.value
  const frame = chosenFrame.value
  if (!target || !image || !frame) return
  target.width = Math.max(1, frame.w)
  target.height = Math.max(1, frame.h)
  const ctx = target.getContext('2d')
  if (ctx) { ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, target.width, target.height); ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h) }
}

watch(() => props.source.id, () => void loadSource(), { immediate: true })
watch(chosenFrame, () => drawSelectedFrame())
onBeforeUnmount(() => { if (image) { image.onload = null; image.onerror = null } })

function saveCopy() {
  if (!canvas.value) return
  canvas.value.toBlob((blob) => {
    if (!blob) { problem.value = 'Không thể mã hóa PNG.'; return }
    emit('save', new File([blob], `${assetName.value || props.source.name}.png`, { type: 'image/png' }), assetName.value || props.source.name, props.source)
    dirty.value = false
  }, 'image/png')
}

function keydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
}
</script>

<template>
  <section class="sprite-editor">
    <header class="editor-toolbar sprite-tools">
      <div class="tool-group">
        <button class="tool-button" :class="{ chosen: tool === 'pencil' }" type="button" title="Bút" @click="tool = 'pencil'">✎ Bút</button>
        <button class="tool-button" :class="{ chosen: tool === 'eraser' }" type="button" title="Tẩy" @click="tool = 'eraser'">◩ Tẩy</button>
      </div>
      <label class="sprite-color">Màu <input v-model="color" type="color" :disabled="tool === 'eraser'" /></label>
      <label class="sprite-brush">Cỡ <input v-model.number="brushSize" type="number" min="1" max="32" /></label>
      <button class="zoom-button" type="button" @click="zoom = Math.max(1, zoom - 1)">−</button><span class="zoom-value">{{ zoom }}×</span><button class="zoom-button" type="button" @click="zoom = Math.min(16, zoom + 1)">+</button>
      <label class="grid-toggle"><input v-model="showGrid" type="checkbox" /> Lưới</label>
      <span class="toolbar-spacer" />
      <button class="secondary-button" type="button" :disabled="!canUndo" @click="undo">Hoàn tác</button>
      <button class="secondary-button" type="button" :disabled="!canRedo" @click="redo">Làm lại</button>
    </header>
    <div class="sprite-source-strip"><span class="source-badge">DATA/{{ source.group.toUpperCase() }}</span><span>{{ source.relativePath }}</span><span>{{ dimensions.width }} × {{ dimensions.height }} px</span><span v-if="dirty" class="dirty-tag">Đã sửa</span></div>
    <div class="sprite-edit-stage checkerboard" :class="{ 'pixel-grid': showGrid && zoom >= 4 }" :style="{ '--pixel-zoom': `${zoom}px` }" @keydown="keydown" tabindex="0">
      <div v-if="busy" class="editor-placeholder">Đang tải sprite…</div>
      <canvas v-else-if="!problem" ref="canvas" class="editable-sprite" :style="{ width: `${dimensions.width * zoom}px`, height: `${dimensions.height * zoom}px` }" @pointerdown="pointerDown" @pointermove="paint" @pointerup="pointerUp" @pointercancel="pointerUp" />
      <div v-if="problem" class="editor-placeholder sprite-problem">{{ problem }}</div>
    </div>
    <div v-if="metadata" class="sprite-metadata-panel">
      <div class="metadata-head"><span>DATABASE METADATA</span><b>{{ metadata.name || `${source.group} #${metadata.id}` }}</b><span v-if="metadata.sprites">{{ metadata.sprites.length }} frame data</span><span v-if="metadata.frames">{{ metadata.frames.length }} animation frames</span></div>
      <div v-if="chosenFrame" class="frame-preview-row">
        <div class="frame-preview checkerboard"><canvas ref="frameCanvas" /></div>
        <div class="frame-info"><strong>Sprite {{ chosenFrame.id }}</strong><span>crop {{ chosenFrame.x }}, {{ chosenFrame.y }} · {{ chosenFrame.w }} × {{ chosenFrame.h }} px</span><small>Preview crop từ sheet gốc</small></div>
        <div class="frame-picker"><button v-for="(frame, index) in frames" :key="`${frame.id}-${index}`" type="button" :class="{ selected: selectedFrame === index }" @click="selectedFrame = index">{{ frame.id }}</button></div>
      </div>
      <div v-if="frameSequence.length" class="sequence-row"><span>SEQUENCE</span><div><button v-for="(frameId, index) in frameSequence.slice(0, 80)" :key="index" type="button" :title="`Bước ${index + 1}: sprite ${frameId}`" @click="selectedFrame = Math.max(0, frames.findIndex((frame) => frame.id === frameId))">{{ frameId }}</button><small v-if="frameSequence.length > 80">+{{ frameSequence.length - 80 }} bước</small></div></div>
      <div v-if="!databaseConnected" class="metadata-note">{{ databaseMessage || 'MariaDB chưa kết nối; vẫn xem/chỉnh được PNG.' }}</div>
      <div v-else-if="!metadata" class="metadata-note">Không có metadata cho sprite này trong các bảng animation.</div>
    </div>
    <footer class="sprite-save-bar"><label>Tên asset<input v-model="assetName" type="text" maxlength="64" /></label><span>Ảnh gốc không bị thay đổi</span><button class="save-button" type="button" :disabled="saving || busy || Boolean(problem)" @click="saveCopy">{{ saving ? 'Đang lưu…' : 'Lưu bản vào project' }}</button></footer>
  </section>
</template>
