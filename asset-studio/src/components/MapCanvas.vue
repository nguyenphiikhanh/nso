<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { GameAsset, GameMap } from '../types/project'

const props = defineProps<{
  map: GameMap
  tiles: GameAsset[]
  brushTileId: string | null
  erasing: boolean
  zoom: number
}>()

const emit = defineEmits<{ paint: [index: number, tileId: string | null] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const dragging = ref(false)
const imageCache = new Map<string, HTMLImageElement>()
const cssWidth = computed(() => `${props.map.width * props.map.tileSize * props.zoom}px`)
const cssHeight = computed(() => `${props.map.height * props.map.tileSize * props.zoom}px`)

function paintAt(event: PointerEvent) {
  if (!canvas.value || !dragging.value) return
  const rect = canvas.value.getBoundingClientRect()
  const col = Math.floor((event.clientX - rect.left) / (props.map.tileSize * props.zoom))
  const row = Math.floor((event.clientY - rect.top) / (props.map.tileSize * props.zoom))
  if (col < 0 || row < 0 || col >= props.map.width || row >= props.map.height) return
  emit('paint', row * props.map.width + col, props.erasing ? null : props.brushTileId)
}

function startPainting(event: PointerEvent) {
  if (event.button === 2) return
  dragging.value = true
  canvas.value?.setPointerCapture(event.pointerId)
  paintAt(event)
}

function finishPainting() {
  dragging.value = false
}

function imageFor(url: string) {
  const existing = imageCache.get(url)
  if (existing) return existing
  const image = new Image()
  image.onload = drawCanvas
  image.src = url
  imageCache.set(url, image)
  return image
}

function drawCanvas() {
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return
  const { width, height, tileSize, tiles: cells } = props.map
  const pixelWidth = width * tileSize
  const pixelHeight = height * tileSize
  if (element.width !== pixelWidth || element.height !== pixelHeight) {
    element.width = pixelWidth
    element.height = pixelHeight
  }
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.fillStyle = '#1a2221'
  context.fillRect(0, 0, pixelWidth, pixelHeight)
  context.imageSmoothingEnabled = false

  for (let index = 0; index < cells.length; index += 1) {
    const col = index % width
    const row = Math.floor(index / width)
    const x = col * tileSize
    const y = row * tileSize
    const tile = props.tiles.find((asset) => asset.id === cells[index])
    if (tile?.imageUrl) {
      const image = imageFor(tile.imageUrl)
      if (image.complete && image.naturalWidth > 0) context.drawImage(image, x, y, tileSize, tileSize)
      else drawSwatch(context, tile, x, y, tileSize)
    } else if (tile) {
      drawSwatch(context, tile, x, y, tileSize)
    } else {
      context.fillStyle = (col + row) % 2 === 0 ? '#242d2d' : '#202829'
      context.fillRect(x, y, tileSize, tileSize)
    }
  }

  context.strokeStyle = 'rgba(7, 12, 13, 0.3)'
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x <= width; x += 1) {
    context.moveTo(x * tileSize + 0.5, 0)
    context.lineTo(x * tileSize + 0.5, pixelHeight)
  }
  for (let y = 0; y <= height; y += 1) {
    context.moveTo(0, y * tileSize + 0.5)
    context.lineTo(pixelWidth, y * tileSize + 0.5)
  }
  context.stroke()
}

function drawSwatch(context: CanvasRenderingContext2D, tile: GameAsset, x: number, y: number, size: number) {
  const color = String(tile.properties.swatch || '#66816d')
  context.fillStyle = color
  context.fillRect(x, y, size, size)
  context.fillStyle = 'rgba(255,255,255,0.07)'
  context.fillRect(x + 2, y + 2, Math.max(0, size - 4), 4)
  context.fillStyle = 'rgba(0,0,0,0.08)'
  context.fillRect(x + 2, y + size - 5, Math.max(0, size - 4), 3)
}

watch(() => [props.map, props.tiles, props.zoom], drawCanvas, { deep: true, flush: 'post' })
onMounted(drawCanvas)
onUnmounted(() => imageCache.clear())
</script>

<template>
  <div class="map-canvas-wrap">
    <canvas
      ref="canvas"
      class="map-canvas"
      :style="{ width: cssWidth, height: cssHeight, cursor: erasing ? 'cell' : 'crosshair' }"
      :aria-label="`Map ${map.name}, ${map.width} cột x ${map.height} hàng`"
      @pointerdown="startPainting"
      @pointermove="paintAt"
      @pointerup="finishPainting"
      @pointercancel="finishPainting"
      @contextmenu.prevent
    />
  </div>
</template>
