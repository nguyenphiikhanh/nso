<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { NsoPart } from '../../types/nso'
import { createCustomPartFromSlices } from '../../services/nso.api'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'part-created', part: NsoPart): void
}>()

// State
const fileInput = ref<HTMLInputElement | null>(null)
const sheetImage = ref<HTMLImageElement | null>(null)
const imageLoaded = ref(false)
const imageName = ref('')
const naturalWidth = ref(0)
const naturalHeight = ref(0)

// Canvas & Viewport
const viewportCanvas = ref<HTMLCanvasElement | null>(null)
const canvasContainer = ref<HTMLDivElement | null>(null)
const zoom = ref(2)
const sliceMode = ref<'grid' | 'rect'>('rect')

// Zoom system (from 0.1x to 8x)
const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]

const formattedZoom = computed(() => {
  const z = zoom.value
  if (z >= 1) {
    return Number.isInteger(z) ? `${z}x` : `${z.toFixed(1)}x`
  }
  return `${Math.round(z * 100)}%`
})

function zoomIn() {
  const current = zoom.value
  const next = ZOOM_STEPS.find((s) => s > current + 0.01)
  if (next !== undefined) {
    zoom.value = next
  } else {
    zoom.value = Math.min(8, Math.round((current + 1) * 10) / 10)
  }
}

function zoomOut() {
  const current = zoom.value
  const prev = [...ZOOM_STEPS].reverse().find((s) => s < current - 0.01)
  if (prev !== undefined) {
    zoom.value = prev
  } else {
    zoom.value = Math.max(0.1, Math.round((current - 0.1) * 100) / 100)
  }
}

function setZoomPreset(val: number) {
  zoom.value = val
}

function fitToScreen() {
  const container = canvasContainer.value
  if (!container || !naturalWidth.value || !naturalHeight.value) return
  const availW = Math.max(64, container.clientWidth - 48)
  const availH = Math.max(64, container.clientHeight - 48)
  const fitZoom = Math.min(availW / naturalWidth.value, availH / naturalHeight.value)
  zoom.value = Math.max(0.1, Math.min(4, Math.round(fitZoom * 100) / 100))
}

function onCanvasWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else if (e.deltaY > 0) {
      zoomOut()
    }
  }
}

// Grid Slice Settings
const cellWidth = ref(32)
const cellHeight = ref(32)
const offsetX = ref(0)
const offsetY = ref(0)
const presetSizes = [16, 24, 32, 48, 64]

// Part Meta
const partName = ref('Trang Phục Tùy Biến')
const partType = ref<0 | 1 | 2 | 3>(0) // 0: Head, 1: Body, 2: Leg, 3: Weapon
const saving = ref(false)
const errorMessage = ref<string | null>(null)

// Selected Frames List
interface SelectedSlice {
  id: string
  x: number
  y: number
  w: number
  h: number
  dx: number
  dy: number
  dataUrl: string
}
const selectedSlices = ref<SelectedSlice[]>([])

// Free Rect / Drag Selection
const autoTrimEnabled = ref(true)
const isDraggingRect = ref(false)
const isDraggingGrid = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragCurrent = ref({ x: 0, y: 0 })

// Floating feedback toast
const sliceToastMsg = ref<string | null>(null)
let sliceToastTimer: number | null = null

function showSliceToast(msg: string) {
  sliceToastMsg.value = msg
  if (sliceToastTimer) window.clearTimeout(sliceToastTimer)
  sliceToastTimer = window.setTimeout(() => {
    sliceToastMsg.value = null
  }, 2800)
}

// Pixel Data Cache for Auto-Detect & Smart-Trim
let cachedImageData: ImageData | null = null

function getImageData(): ImageData | null {
  if (cachedImageData) return cachedImageData
  const img = sheetImage.value
  if (!img || !img.naturalWidth || !img.naturalHeight) return null
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = img.naturalWidth
  tempCanvas.height = img.naturalHeight
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  cachedImageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
  return cachedImageData
}

// Auto-Trim: Finds non-transparent bounding box inside [rx, ry, rw, rh]
function trimBoundingBox(rx: number, ry: number, rw: number, rh: number): { x: number; y: number; w: number; h: number } | null {
  const data = getImageData()
  if (!data) return { x: rx, y: ry, w: rw, h: rh }
  const imgW = data.width
  const imgH = data.height
  const pixels = data.data

  const minX = Math.max(0, rx)
  const minY = Math.max(0, ry)
  const maxX = Math.min(imgW - 1, rx + rw)
  const maxY = Math.min(imgH - 1, ry + rh)

  let foundMinX = maxX
  let foundMaxX = minX
  let foundMinY = maxY
  let foundMaxY = minY
  let hasPixel = false

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const alphaIndex = (y * imgW + x) * 4 + 3
      if (pixels[alphaIndex] > 8) {
        hasPixel = true
        if (x < foundMinX) foundMinX = x
        if (x > foundMaxX) foundMaxX = x
        if (y < foundMinY) foundMinY = y
        if (y > foundMaxY) foundMaxY = y
      }
    }
  }

  if (!hasPixel) return null
  return {
    x: foundMinX,
    y: foundMinY,
    w: foundMaxX - foundMinX + 1,
    h: foundMaxY - foundMinY + 1,
  }
}

// Magic Wand / Click-to-Detect: BFS flood fill connected component from click
function findConnectedSpriteBounds(startX: number, startY: number): { x: number; y: number; w: number; h: number } | null {
  const data = getImageData()
  if (!data) return null
  const imgW = data.width
  const imgH = data.height
  const pixels = data.data

  if (startX < 0 || startX >= imgW || startY < 0 || startY >= imgH) return null
  const startAlpha = pixels[(startY * imgW + startX) * 4 + 3]
  if (startAlpha <= 8) return null

  const visited = new Uint8Array(imgW * imgH)
  const queue: number[] = [startY * imgW + startX]
  visited[startY * imgW + startX] = 1

  let minX = startX
  let maxX = startX
  let minY = startY
  let maxY = startY

  let count = 0
  const maxPixels = 250000

  while (queue.length > 0 && count < maxPixels) {
    const idx = queue.pop()!
    count++
    const curX = idx % imgW
    const curY = Math.floor(idx / imgW)

    if (curX < minX) minX = curX
    if (curX > maxX) maxX = curX
    if (curY < minY) minY = curY
    if (curY > maxY) maxY = curY

    if (curX > 0) {
      const left = idx - 1
      if (!visited[left]) {
        visited[left] = 1
        if (pixels[left * 4 + 3] > 8) queue.push(left)
      }
    }
    if (curX < imgW - 1) {
      const right = idx + 1
      if (!visited[right]) {
        visited[right] = 1
        if (pixels[right * 4 + 3] > 8) queue.push(right)
      }
    }
    if (curY > 0) {
      const up = idx - imgW
      if (!visited[up]) {
        visited[up] = 1
        if (pixels[up * 4 + 3] > 8) queue.push(up)
      }
    }
    if (curY < imgH - 1) {
      const down = idx + imgW
      if (!visited[down]) {
        visited[down] = 1
        if (pixels[down * 4 + 3] > 8) queue.push(down)
      }
    }
  }

  const w = maxX - minX + 1
  const h = maxY - minY + 1
  if (w < 4 || h < 4) return null
  return { x: minX, y: minY, w, h }
}

// Live Animation Preview
const previewFrameIndex = ref(0)
const previewPlaying = ref(true)
const previewFps = ref(6)
let previewTimer: number | null = null

// Hover state for Grid
const hoveredGridCell = ref<{ col: number; row: number } | null>(null)

// Computed
const totalCols = computed(() => {
  if (!naturalWidth.value || cellWidth.value <= 0) return 0
  return Math.floor((naturalWidth.value - offsetX.value) / cellWidth.value)
})

const totalRows = computed(() => {
  if (!naturalHeight.value || cellHeight.value <= 0) return 0
  return Math.floor((naturalHeight.value - offsetY.value) / cellHeight.value)
})

const partTypeLabels = [
  { type: 0, label: '👦 Đầu / Tóc', cat: 'head' },
  { type: 1, label: '🥋 Thân / Áo', cat: 'body' },
  { type: 2, label: '👖 Quần / Chân', cat: 'leg' },
  { type: 3, label: '🗡️ Vũ khí', cat: 'weapon' },
]

// Handle File Selection / Drop
function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  loadFile(input.files[0])
}

function onDropFile(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer && event.dataTransfer.files.length > 0) {
    loadFile(event.dataTransfer.files[0])
  }
}

function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Vui lòng chọn file ảnh hợp lệ (.png, .jpg).'
    return
  }
  errorMessage.value = null
  imageName.value = file.name.replace(/\.[^/.]+$/, '')
  partName.value = `Trang Phục ${imageName.value}`

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      sheetImage.value = img
      cachedImageData = null
      naturalWidth.value = img.naturalWidth
      naturalHeight.value = img.naturalHeight
      imageLoaded.value = true
      selectedSlices.value = []

      // Auto pick best grid size
      if (img.naturalWidth % 32 === 0 && img.naturalHeight % 32 === 0) {
        cellWidth.value = 32
        cellHeight.value = 32
      } else if (img.naturalWidth % 24 === 0 && img.naturalHeight % 24 === 0) {
        cellWidth.value = 24
        cellHeight.value = 24
      } else if (img.naturalWidth % 48 === 0 && img.naturalHeight % 48 === 0) {
        cellWidth.value = 48
        cellHeight.value = 48
      } else if (img.naturalWidth % 16 === 0 && img.naturalHeight % 16 === 0) {
        cellWidth.value = 16
        cellHeight.value = 16
      }

      nextTick(() => {
        if (img.naturalWidth > 500 || img.naturalHeight > 450) {
          fitToScreen()
        } else if (img.naturalWidth <= 128 && img.naturalHeight <= 128) {
          zoom.value = 3
        } else if (img.naturalWidth <= 256 && img.naturalHeight <= 256) {
          zoom.value = 2
        } else {
          zoom.value = 1
        }
        renderViewport()
      })
    }
    img.src = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function selectPresetSize(size: number) {
  cellWidth.value = size
  cellHeight.value = size
  renderViewport()
}

// Render Canvas
function renderViewport() {
  const canvas = viewportCanvas.value
  const img = sheetImage.value
  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = Math.max(1, Math.round(naturalWidth.value * zoom.value))
  canvas.height = Math.max(1, Math.round(naturalHeight.value * zoom.value))

  ctx.imageSmoothingEnabled = false

  // Draw background checkerboard
  const bgSize = 12
  for (let y = 0; y < canvas.height; y += bgSize) {
    for (let x = 0; x < canvas.width; x += bgSize) {
      ctx.fillStyle = ((x / bgSize) + (y / bgSize)) % 2 === 0 ? '#141A1C' : '#1C2426'
      ctx.fillRect(x, y, bgSize, bgSize)
    }
  }

  // Draw Main Image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // Draw Grid if in Grid Mode
  if (sliceMode.value === 'grid' && cellWidth.value > 0 && cellHeight.value > 0) {
    const scaledW = cellWidth.value * zoom.value
    const scaledH = cellHeight.value * zoom.value
    const startX = offsetX.value * zoom.value
    const startY = offsetY.value * zoom.value

    ctx.strokeStyle = 'rgba(52, 65, 67, 0.75)'
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = startX; x <= canvas.width; x += scaledW) {
      const px = Math.round(x)
      ctx.beginPath()
      ctx.moveTo(px + 0.5, 0)
      ctx.lineTo(px + 0.5, canvas.height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = startY; y <= canvas.height; y += scaledH) {
      const py = Math.round(y)
      ctx.beginPath()
      ctx.moveTo(0, py + 0.5)
      ctx.lineTo(canvas.width, py + 0.5)
      ctx.stroke()
    }

    // Draw Hovered Cell
    if (hoveredGridCell.value) {
      const hx = Math.round(startX + hoveredGridCell.value.col * scaledW)
      const hy = Math.round(startY + hoveredGridCell.value.row * scaledH)
      const hw = Math.round(scaledW)
      const hh = Math.round(scaledH)
      ctx.fillStyle = 'rgba(185, 243, 107, 0.15)'
      ctx.fillRect(hx, hy, hw, hh)
      ctx.strokeStyle = 'rgba(185, 243, 107, 0.5)'
      ctx.strokeRect(hx + 0.5, hy + 0.5, Math.max(1, hw - 1), Math.max(1, hh - 1))
    }
  }

  // Highlight Selected Slices
  selectedSlices.value.forEach((slice, idx) => {
    const sx = Math.round(slice.x * zoom.value)
    const sy = Math.round(slice.y * zoom.value)
    const sw = Math.round(slice.w * zoom.value)
    const sh = Math.round(slice.h * zoom.value)

    // Tint
    ctx.fillStyle = 'rgba(185, 243, 107, 0.28)'
    ctx.fillRect(sx, sy, sw, sh)

    // Border
    ctx.strokeStyle = '#B9F36B'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 1, sy + 1, Math.max(1, sw - 2), Math.max(1, sh - 2))

    // Sequence Badge
    if (sw >= 18 && sh >= 14) {
      const badgeW = Math.min(24, sw)
      const badgeH = Math.min(16, sh)
      ctx.fillStyle = '#18210F'
      ctx.fillRect(sx + 2, sy + 2, badgeW, badgeH)
      ctx.fillStyle = '#B9F36B'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`#${idx + 1}`, sx + 4, sy + 13)
    }
  })

  // Draw Current Free Drag Selection
  if (isDraggingRect.value && sliceMode.value === 'rect') {
    const rx = Math.min(dragStart.value.x, dragCurrent.value.x)
    const ry = Math.min(dragStart.value.y, dragCurrent.value.y)
    const rw = Math.abs(dragCurrent.value.x - dragStart.value.x)
    const rh = Math.abs(dragCurrent.value.y - dragStart.value.y)

    // Outer Selection Marquee (Amber Dashed)
    ctx.fillStyle = 'rgba(241, 167, 115, 0.18)'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = '#F1A773'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 3])
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.setLineDash([])

    // If auto-trim is enabled, show live trimmed preview in lime green
    const z = zoom.value
    const origRx = Math.floor(rx / z)
    const origRy = Math.floor(ry / z)
    const origRw = Math.ceil(rw / z)
    const origRh = Math.ceil(rh / z)

    if (autoTrimEnabled.value && origRw >= 5 && origRh >= 5) {
      const trimmed = trimBoundingBox(origRx, origRy, origRw, origRh)
      if (trimmed) {
        const tx = Math.round(trimmed.x * z)
        const ty = Math.round(trimmed.y * z)
        const tw = Math.round(trimmed.w * z)
        const th = Math.round(trimmed.h * z)

        ctx.strokeStyle = '#B9F36B'
        ctx.lineWidth = 2
        ctx.strokeRect(tx + 0.5, ty + 0.5, Math.max(1, tw - 1), Math.max(1, th - 1))
      }
    }

    // Dimensions tooltip badge near mouse
    if (rw > 14 && rh > 14) {
      const badgeText = `${origRw} × ${origRh}px`
      ctx.font = 'bold 10px monospace'
      const textMetrics = ctx.measureText(badgeText)
      const badgeW = textMetrics.width + 10
      const badgeH = 17
      const badgeX = rx + rw - badgeW
      const badgeY = ry + rh + 4 < canvas.height - 20 ? ry + rh + 4 : ry - badgeH - 4

      ctx.fillStyle = '#101416'
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH)
      ctx.strokeStyle = '#F1A773'
      ctx.lineWidth = 1
      ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1)
      ctx.fillStyle = '#F1A773'
      ctx.fillText(badgeText, badgeX + 5, badgeY + 12)
    }
  }
}

// Slice Extraction
function extractSliceDataUrl(x: number, y: number, w: number, h: number): string {
  const img = sheetImage.value
  if (!img) return ''

  const offCanvas = document.createElement('canvas')
  offCanvas.width = Math.max(1, Math.round(w))
  offCanvas.height = Math.max(1, Math.round(h))
  const offCtx = offCanvas.getContext('2d')
  if (!offCtx) return ''

  offCtx.imageSmoothingEnabled = false
  offCtx.drawImage(img, x, y, w, h, 0, 0, offCanvas.width, offCanvas.height)
  return offCanvas.toDataURL('image/png')
}

// Interaction with Canvas
function onCanvasMouseMove(e: MouseEvent) {
  if (!viewportCanvas.value) return
  const rect = viewportCanvas.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  if (sliceMode.value === 'grid') {
    const scaledW = cellWidth.value * zoom.value
    const scaledH = cellHeight.value * zoom.value
    const startX = offsetX.value * zoom.value
    const startY = offsetY.value * zoom.value

    if (mouseX >= startX && mouseY >= startY) {
      const col = Math.floor((mouseX - startX) / scaledW)
      const row = Math.floor((mouseY - startY) / scaledH)
      if (col < totalCols.value && row < totalRows.value) {
        hoveredGridCell.value = { col, row }
      } else {
        hoveredGridCell.value = null
      }
    } else {
      hoveredGridCell.value = null
    }
  }
  renderViewport()
}

function onCanvasMouseDown(e: MouseEvent) {
  if (!viewportCanvas.value) return
  const rect = viewportCanvas.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  if (sliceMode.value === 'grid') {
    isDraggingGrid.value = true
    const scaledW = cellWidth.value * zoom.value
    const scaledH = cellHeight.value * zoom.value
    const startX = offsetX.value * zoom.value
    const startY = offsetY.value * zoom.value

    const col = Math.floor((mouseX - startX) / scaledW)
    const row = Math.floor((mouseY - startY) / scaledH)

    if (col >= 0 && col < totalCols.value && row >= 0 && row < totalRows.value) {
      const sliceX = offsetX.value + col * cellWidth.value
      const sliceY = offsetY.value + row * cellHeight.value
      toggleGridCellSelection(sliceX, sliceY, cellWidth.value, cellHeight.value)
    }
  } else {
    isDraggingRect.value = true
    dragStart.value = { x: mouseX, y: mouseY }
    dragCurrent.value = { x: mouseX, y: mouseY }
  }

  // Attach global mouse listeners so dragging is seamless even if mouse exits canvas
  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

function onGlobalMouseMove(e: MouseEvent) {
  if (!viewportCanvas.value) return
  const rect = viewportCanvas.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  if (isDraggingRect.value) {
    dragCurrent.value = { x: mouseX, y: mouseY }
    renderViewport()
  } else if (isDraggingGrid.value && sliceMode.value === 'grid') {
    const scaledW = cellWidth.value * zoom.value
    const scaledH = cellHeight.value * zoom.value
    const startX = offsetX.value * zoom.value
    const startY = offsetY.value * zoom.value

    if (mouseX >= startX && mouseY >= startY) {
      const col = Math.floor((mouseX - startX) / scaledW)
      const row = Math.floor((mouseY - startY) / scaledH)
      if (col >= 0 && col < totalCols.value && row >= 0 && row < totalRows.value) {
        const sliceX = offsetX.value + col * cellWidth.value
        const sliceY = offsetY.value + row * cellHeight.value
        // If not already in selectedSlices, add it
        const exists = selectedSlices.value.some(
          (s) => Math.abs(s.x - sliceX) < 2 && Math.abs(s.y - sliceY) < 2
        )
        if (!exists) {
          addSlice(sliceX, sliceY, cellWidth.value, cellHeight.value)
        }
      }
    }
  }
}

function onGlobalMouseUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)

  if (isDraggingGrid.value) {
    isDraggingGrid.value = false
    renderViewport()
    return
  }

  if (isDraggingRect.value) {
    isDraggingRect.value = false
    const z = zoom.value
    const dragDist = Math.hypot(
      dragCurrent.value.x - dragStart.value.x,
      dragCurrent.value.y - dragStart.value.y
    )

    if (dragDist < 6) {
      // User performed a single Click -> Trigger Auto-Detect Sprite at click position!
      const clickX = Math.floor(dragStart.value.x / z)
      const clickY = Math.floor(dragStart.value.y / z)
      const bounds = findConnectedSpriteBounds(clickX, clickY)
      if (bounds) {
        addSlice(bounds.x, bounds.y, bounds.w, bounds.h)
        showSliceToast(`✨ Đã nhận diện chi tiết: ${bounds.w}×${bounds.h}px (#${selectedSlices.value.length})`)
      } else {
        showSliceToast('💡 Kéo chuột để khoanh vùng chi tiết cần tách hoặc click vào hình vẽ.')
      }
    } else {
      // User dragged a box (Khoanh vùng)
      const rx = Math.floor(Math.min(dragStart.value.x, dragCurrent.value.x) / z)
      const ry = Math.floor(Math.min(dragStart.value.y, dragCurrent.value.y) / z)
      const rw = Math.ceil(Math.abs(dragCurrent.value.x - dragStart.value.x) / z)
      const rh = Math.ceil(Math.abs(dragCurrent.value.y - dragStart.value.y) / z)

      if (rw >= 4 && rh >= 4) {
        if (autoTrimEnabled.value) {
          const trimmed = trimBoundingBox(rx, ry, rw, rh)
          if (trimmed && trimmed.w >= 4 && trimmed.h >= 4) {
            addSlice(trimmed.x, trimmed.y, trimmed.w, trimmed.h)
            showSliceToast(`✂️ Đã khoanh & bo sát chi tiết: ${trimmed.w}×${trimmed.h}px (#${selectedSlices.value.length})`)
          } else {
            showSliceToast('⚠️ Không tìm thấy điểm ảnh nào trong vùng vừa khoanh.')
          }
        } else {
          addSlice(rx, ry, rw, rh)
          showSliceToast(`📦 Đã tách vùng khoanh: ${rw}×${rh}px (#${selectedSlices.value.length})`)
        }
      }
    }

    renderViewport()
  }
}

function onCanvasMouseUp() {
  // Fallback for canvas mouseup
  if (isDraggingRect.value || isDraggingGrid.value) {
    onGlobalMouseUp(new MouseEvent('mouseup'))
  }
}

function toggleGridCellSelection(x: number, y: number, w: number, h: number) {
  const existingIdx = selectedSlices.value.findIndex(
    (s) => Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2 && Math.abs(s.w - w) < 2
  )
  if (existingIdx >= 0) {
    selectedSlices.value.splice(existingIdx, 1)
  } else {
    addSlice(x, y, w, h)
  }
  renderViewport()
}

function addSlice(x: number, y: number, w: number, h: number) {
  const dataUrl = extractSliceDataUrl(x, y, w, h)
  selectedSlices.value.push({
    id: `slice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    x,
    y,
    w,
    h,
    dx: 0,
    dy: 0,
    dataUrl,
  })
}

function removeSlice(index: number) {
  selectedSlices.value.splice(index, 1)
  renderViewport()
}

function moveSlice(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= selectedSlices.value.length) return
  const item = selectedSlices.value.splice(index, 1)[0]
  selectedSlices.value.splice(target, 0, item)
  renderViewport()
}

function clearAllSlices() {
  selectedSlices.value = []
  renderViewport()
}

// Quick Select Entire Row
function selectRow(rowIdx: number) {
  for (let c = 0; c < totalCols.value; c++) {
    const sx = offsetX.value + c * cellWidth.value
    const sy = offsetY.value + rowIdx * cellHeight.value
    if (!selectedSlices.value.some((s) => s.x === sx && s.y === sy)) {
      addSlice(sx, sy, cellWidth.value, cellHeight.value)
    }
  }
  renderViewport()
}

// Animation Preview Loop
function startAnimationPreview() {
  if (previewTimer) clearInterval(previewTimer)
  previewTimer = window.setInterval(() => {
    if (!previewPlaying.value || selectedSlices.value.length === 0) return
    previewFrameIndex.value = (previewFrameIndex.value + 1) % selectedSlices.value.length
  }, Math.max(50, 1000 / previewFps.value))
}

watch([previewPlaying, previewFps, selectedSlices], () => {
  startAnimationPreview()
})

watch([zoom, cellWidth, cellHeight, offsetX, offsetY, sliceMode], () => {
  renderViewport()
})

onMounted(() => {
  startAnimationPreview()
})

onUnmounted(() => {
  if (previewTimer) clearInterval(previewTimer)
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
})

// Submit & Save Custom Part
async function createCustomPart() {
  if (selectedSlices.value.length === 0) {
    errorMessage.value = 'Chưa chọn khung hình (frame) nào từ Sprite Sheet.'
    return
  }

  saving.value = true
  errorMessage.value = null

  try {
    const payload = {
      name: partName.value.trim() || 'Trang Phục Tùy Biến',
      type: partType.value,
      slices: selectedSlices.value.map((s) => ({
        dataUrl: s.dataUrl,
        dx: s.dx || 0,
        dy: s.dy || 0,
      })),
    }

    const res = await createCustomPartFromSlices(payload)
    emit('part-created', res.part)
    emit('close')
  } catch (err: any) {
    errorMessage.value = err.message || 'Lỗi khi tạo trang phục từ sprite sheet.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="slicer-modal">
      <!-- HEADER -->
      <header class="modal-header">
        <div class="header-left">
          <div class="title-icon">✂️</div>
          <div>
            <h2 class="modal-title">Nhập Sprite Sheet & Tự Thiết Kế Nhân Vật</h2>
            <p class="modal-subtitle">
              Cắt khung hình từ file PNG để tạo bộ phận Đầu, Thân, Chân hoặc Vũ khí mới.
            </p>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')" title="Đóng">✕</button>
      </header>

      <!-- BODY: 2 COLUMNS -->
      <div class="modal-body">
        <!-- LEFT: CANVAS VIEWPORT -->
        <section class="canvas-panel">
          <!-- Dropzone if not loaded -->
          <div
            v-if="!imageLoaded"
            class="dropzone-area"
            @dragover.prevent
            @drop="onDropFile"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style="display: none"
              @change="onFileSelected"
            />
            <div class="drop-icon">🖼️</div>
            <div class="drop-title">Kéo thả file Sprite Sheet (.png) vào đây</div>
            <div class="drop-desc">Hoặc bấm để duyệt file từ máy tính của bạn</div>
            <button class="btn-browse" type="button">📂 Chọn File Ảnh</button>
          </div>

          <!-- Canvas Viewport if loaded -->
          <div v-else class="canvas-workspace">
            <!-- Floating Toast Notification -->
            <div v-if="sliceToastMsg" class="canvas-floating-toast">
              {{ sliceToastMsg }}
            </div>

            <!-- Viewport Toolbar -->
            <div class="viewport-toolbar">
              <div class="tb-group slice-mode-tabs">
                <button
                  class="btn-tb mode-btn"
                  :class="{ active: sliceMode === 'rect' }"
                  @click="sliceMode = 'rect'"
                  title="Kéo thả chuột để khoanh vùng chi tiết, hoặc click 1 cái vào ảnh để tự động tách"
                >
                  🎯 Khoanh Chi Tiết
                </button>
                <button
                  class="btn-tb mode-btn"
                  :class="{ active: sliceMode === 'grid' }"
                  @click="sliceMode = 'grid'"
                  title="Cắt theo lưới đều bằng nhau"
                >
                  ▦ Lưới Đều
                </button>

                <label
                  v-if="sliceMode === 'rect'"
                  class="trim-toggle-label"
                  title="Tự động thu hẹp viền ôm sát các điểm ảnh (bỏ vùng trong suốt)"
                >
                  <input type="checkbox" v-model="autoTrimEnabled" />
                  <span>✂️ Bo Sát Viền (Trim)</span>
                </label>
              </div>

              <!-- Zoom Controls -->
              <div class="tb-group zoom-group">
                <span class="tb-label">Thu phóng:</span>
                <button
                  class="btn-tb-icon"
                  title="Thu nhỏ (- hoặc Ctrl + Lăn chuột xuống)"
                  :disabled="zoom <= 0.1"
                  @click="zoomOut"
                >
                  -
                </button>
                <span class="zoom-value">{{ formattedZoom }}</span>
                <button
                  class="btn-tb-icon"
                  title="Phóng to (+ hoặc Ctrl + Lăn chuột lên)"
                  :disabled="zoom >= 8"
                  @click="zoomIn"
                >
                  +
                </button>

                <!-- Zoom Presets -->
                <div class="zoom-presets">
                  <button
                    v-for="preset in [0.25, 0.5, 1, 2]"
                    :key="preset"
                    class="btn-zoom-preset"
                    :class="{ active: Math.abs(zoom - preset) < 0.05 }"
                    :title="`Thu phóng ${preset >= 1 ? `${preset}x` : `${preset * 100}%`}`"
                    @click="setZoomPreset(preset)"
                  >
                    {{ preset >= 1 ? `${preset}x` : `${preset * 100}%` }}
                  </button>
                  <button
                    class="btn-zoom-preset btn-fit"
                    title="Tự động thu phóng vừa vặn khung nhìn"
                    @click="fitToScreen"
                  >
                    ⛶ Vừa Khung
                  </button>
                </div>
              </div>

              <!-- File Info -->
              <div class="tb-group file-info">
                <span>{{ imageName }}.png</span>
                <span class="dim-badge">{{ naturalWidth }} × {{ naturalHeight }}px</span>
                <button class="btn-tb-link" @click="imageLoaded = false">Đổi ảnh khác</button>
              </div>
            </div>

            <!-- Scrollable Canvas Area with Mouse Wheel Zoom -->
            <div
              ref="canvasContainer"
              class="canvas-scroll-container"
              @wheel="onCanvasWheel"
            >
              <canvas
                ref="viewportCanvas"
                class="slicer-canvas"
                @mousemove="onCanvasMouseMove"
                @mousedown="onCanvasMouseDown"
                @mouseup="onCanvasMouseUp"
                @mouseleave="hoveredGridCell = null; renderViewport()"
              ></canvas>
            </div>

            <!-- Canvas Quick Tips -->
            <div class="canvas-tips">
              <span v-if="sliceMode === 'rect'">
                🎯 <b>Khoanh tách chi tiết:</b> Kéo chuột trên ảnh để khoanh vùng bất kỳ (khung viền xanh lá sẽ tự động bo sát chi tiết). <b>Click 1 cái</b> vào chi tiết để tự động nhận diện. Giữ <b>Ctrl + Lăn chuột</b> để thu phóng.
              </span>
              <span v-else>
                ▦ <b>Cắt theo lưới:</b> Kéo chuột hoặc click các ô lưới để chọn frame. Giữ <b>Ctrl + Lăn chuột</b> để thu phóng.
              </span>
            </div>
          </div>
        </section>

        <!-- RIGHT: INSPECTOR & CONTROLS -->
        <aside class="inspector-panel">
          <!-- 1. Grid Size Settings (nếu ở Grid Mode) -->
          <div v-if="imageLoaded && sliceMode === 'grid'" class="panel-section">
            <h3 class="section-title">📐 Cấu Hình Lưới Ô (Grid)</h3>
            <div class="grid-presets">
              <span class="preset-label">Kích thước mẫu:</span>
              <button
                v-for="s in presetSizes"
                :key="s"
                class="btn-preset"
                :class="{ active: cellWidth === s && cellHeight === s }"
                @click="selectPresetSize(s)"
              >
                {{ s }}×{{ s }}
              </button>
            </div>

            <div class="inputs-row">
              <label class="input-field">
                <span>Rộng (W):</span>
                <input v-model.number="cellWidth" type="number" min="8" max="256" step="2" />
              </label>
              <label class="input-field">
                <span>Cao (H):</span>
                <input v-model.number="cellHeight" type="number" min="8" max="256" step="2" />
              </label>
            </div>

            <div class="inputs-row">
              <label class="input-field">
                <span>Lệch X:</span>
                <input v-model.number="offsetX" type="number" min="0" max="100" />
              </label>
              <label class="input-field">
                <span>Lệch Y:</span>
                <input v-model.number="offsetY" type="number" min="0" max="100" />
              </label>
            </div>

            <div class="grid-stats">
              <span>Tổng số ô: <b>{{ totalCols * totalRows }}</b> ({{ totalCols }} cột × {{ totalRows }} hàng)</span>
              <button
                v-if="totalRows > 0"
                class="btn-quick-row"
                @click="selectRow(0)"
                title="Chọn nhanh cả hàng đầu tiên"
              >
                + Chọn hàng 1
              </button>
            </div>
          </div>

          <!-- 2. Part Category & Metadata -->
          <div class="panel-section">
            <h3 class="section-title">👤 Thông Tin Trang Phục Mới</h3>
            <div class="field-wrap">
              <label class="field-label">Tên trang phục:</label>
              <input
                v-model="partName"
                type="text"
                class="text-input"
                placeholder="Nhập tên trang phục..."
              />
            </div>

            <div class="field-wrap">
              <label class="field-label">Phân loại bộ phận:</label>
              <div class="category-grid">
                <button
                  v-for="cat in partTypeLabels"
                  :key="cat.type"
                  class="btn-cat"
                  :class="{ active: partType === cat.type }"
                  @click="partType = cat.type as 0 | 1 | 2 | 3"
                >
                  {{ cat.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Selected Slices & Live Preview -->
          <div class="panel-section flex-grow">
            <div class="section-header-row">
              <h3 class="section-title">
                🎞️ Khung Hình Đã Chọn
                <span class="count-badge">{{ selectedSlices.length }}</span>
              </h3>
              <button
                v-if="selectedSlices.length > 0"
                class="btn-clear-all"
                @click="clearAllSlices"
              >
                Xóa hết
              </button>
            </div>

            <!-- Empty State -->
            <div v-if="selectedSlices.length === 0" class="empty-slices">
              <div class="empty-icon">🖱️</div>
              <p>Chưa có khung hình nào được chọn.</p>
              <span class="empty-hint">Click vào các ô trên canvas bên trái để bắt đầu cắt.</span>
            </div>

            <!-- Slices List & Preview Area -->
            <div v-else class="slices-container">
              <!-- Live Loop Animation Preview -->
              <div class="anim-preview-box">
                <div class="preview-stage">
                  <img
                    v-if="selectedSlices[previewFrameIndex]"
                    :src="selectedSlices[previewFrameIndex].dataUrl"
                    class="preview-img"
                    alt="Frame preview"
                  />
                </div>
                <div class="preview-controls">
                  <div class="preview-badge">
                    Frame {{ previewFrameIndex + 1 }} / {{ selectedSlices.length }}
                  </div>
                  <div class="playback-actions">
                    <button
                      class="btn-play-pause"
                      @click="previewPlaying = !previewPlaying"
                      :title="previewPlaying ? 'Tạm dừng' : 'Chạy thử'"
                    >
                      {{ previewPlaying ? '⏸' : '▶' }}
                    </button>
                    <label class="speed-label">
                      <span>{{ previewFps }} FPS</span>
                      <input
                        v-model.number="previewFps"
                        type="range"
                        min="2"
                        max="16"
                        step="1"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <!-- Selected Frames Thumbnails -->
              <div class="slices-grid">
                <div
                  v-for="(slice, sIdx) in selectedSlices"
                  :key="slice.id"
                  class="slice-card"
                  :class="{ active: previewFrameIndex === sIdx }"
                >
                  <div class="slice-index-badge">#{{ sIdx + 1 }}</div>
                  <div class="slice-thumb-box">
                    <img :src="slice.dataUrl" class="slice-thumb-img" alt="Slice thumb" />
                  </div>
                  <div class="slice-dims">{{ slice.w }}×{{ slice.h }}px</div>
                  <div class="slice-actions">
                    <button
                      class="btn-slice-move"
                      :disabled="sIdx === 0"
                      @click="moveSlice(sIdx, -1)"
                      title="Chuyển lên trước"
                    >
                      ◀
                    </button>
                    <button
                      class="btn-slice-del"
                      @click="removeSlice(sIdx)"
                      title="Xóa frame này"
                    >
                      ✕
                    </button>
                    <button
                      class="btn-slice-move"
                      :disabled="sIdx === selectedSlices.length - 1"
                      @click="moveSlice(sIdx, 1)"
                      title="Chuyển ra sau"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="error-banner">
            ⚠️ {{ errorMessage }}
          </div>

          <!-- FOOTER ACTION BUTTONS -->
          <footer class="panel-footer">
            <button class="btn-cancel" @click="emit('close')" :disabled="saving">
              Hủy Bỏ
            </button>
            <button
              class="btn-create"
              :disabled="saving || selectedSlices.length === 0"
              @click="createCustomPart"
            >
              <span v-if="saving" class="spinner">⏳</span>
              <span v-else>✨ Tạo & Thêm Vào Kho</span>
            </button>
          </footer>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(16, 20, 22, 0.88);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.slicer-modal {
  width: 96vw;
  max-width: 1300px;
  height: 90vh;
  max-height: 850px;
  background-color: #171D1F;
  border: 1px solid #344143;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
}

/* HEADER */
.modal-header {
  height: 60px;
  padding: 0 20px;
  background-color: #20282A;
  border-bottom: 1px solid #344143;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 24px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #E9EFEB;
}

.modal-subtitle {
  margin: 2px 0 0;
  font-size: 11px;
  color: #98A6A1;
}

.btn-close {
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 18px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background-color: #293335;
  color: #EF7772;
}

/* BODY */
.modal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* LEFT CANVAS PANEL */
.canvas-panel {
  flex: 1.35;
  background-color: #101416;
  border-right: 1px solid #344143;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropzone-area {
  flex: 1;
  margin: 24px;
  border: 2px dashed #344143;
  border-radius: 8px;
  background-color: #171D1F;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.dropzone-area:hover {
  border-color: #B9F36B;
  background-color: #20282A;
}

.drop-icon {
  font-size: 54px;
}

.drop-title {
  font-size: 15px;
  font-weight: 600;
  color: #E9EFEB;
}

.drop-desc {
  font-size: 12px;
  color: #98A6A1;
}

.btn-browse {
  margin-top: 8px;
  padding: 8px 18px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.canvas-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.canvas-floating-toast {
  position: absolute;
  top: 54px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  background-color: rgba(23, 29, 31, 0.95);
  color: #E9EFEB;
  border: 1px solid #B9F36B;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  animation: fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.slice-mode-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.trim-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 6px;
  padding: 4px 8px;
  background-color: #20282A;
  border: 1px solid #344143;
  border-radius: 4px;
  font-size: 11px;
  color: #E9EFEB;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.trim-toggle-label:hover {
  background-color: #293335;
  border-color: #B9F36B;
}

.trim-toggle-label input[type="checkbox"] {
  accent-color: #B9F36B;
  cursor: pointer;
}

.viewport-toolbar {
  height: 44px;
  padding: 0 16px;
  background-color: #171D1F;
  border-bottom: 1px solid #344143;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.tb-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-tb {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid #344143;
  background-color: #20282A;
  color: #98A6A1;
  cursor: pointer;
}

.btn-tb.active {
  background-color: #293A21;
  color: #B9F36B;
  border-color: #B9F36B;
}

.btn-tb-icon {
  width: 26px;
  height: 26px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.btn-tb-icon:hover:not(:disabled) {
  background-color: #293335;
  border-color: #B9F36B;
}

.btn-tb-icon:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: #283335;
  color: #657572;
}

.zoom-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tb-label {
  font-size: 11px;
  color: #98A6A1;
}

.zoom-value {
  font-size: 11px;
  font-weight: 600;
  color: #B9F36B;
  min-width: 34px;
  text-align: center;
  font-family: monospace;
}

.zoom-presets {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
}

.btn-zoom-preset {
  padding: 3px 6px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.btn-zoom-preset:hover {
  background-color: #293335;
  color: #E9EFEB;
  border-color: #556260;
}

.btn-zoom-preset.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-zoom-preset.btn-fit {
  color: #F1A773;
  border-color: rgba(241, 167, 115, 0.4);
}

.btn-zoom-preset.btn-fit:hover {
  background-color: rgba(241, 167, 115, 0.15);
  border-color: #F1A773;
}

.file-info {
  font-size: 11px;
  color: #98A6A1;
}

.dim-badge {
  background-color: #20282A;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #344143;
  color: #E9EFEB;
}

.btn-tb-link {
  background: none;
  border: none;
  color: #F1A773;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 4px;
}

.canvas-scroll-container {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: flex;
  background-color: #101416;
}

.slicer-canvas {
  margin: auto;
  image-rendering: pixelated;
  border: 1px solid #344143;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  cursor: crosshair;
}

.canvas-tips {
  height: 32px;
  padding: 0 16px;
  background-color: #171D1F;
  border-top: 1px solid #344143;
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #98A6A1;
}

/* RIGHT INSPECTOR PANEL */
.inspector-panel {
  flex: 1;
  background-color: #171D1F;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-section {
  padding: 14px 18px;
  border-bottom: 1px solid #344143;
}

.panel-section.flex-grow {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: none;
}

.section-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #E9EFEB;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.count-badge {
  background-color: #293A21;
  color: #B9F36B;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #B9F36B;
}

.btn-clear-all {
  background: none;
  border: none;
  color: #EF7772;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

/* GRID CONTROLS */
.grid-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.preset-label {
  font-size: 11px;
  color: #98A6A1;
}

.btn-preset {
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  cursor: pointer;
}

.btn-preset.active {
  background-color: #B9F36B;
  color: #18210F;
  border-color: #B9F36B;
}

.inputs-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 8px;
}

.input-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #20282A;
  border: 1px solid #344143;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #98A6A1;
}

.input-field input {
  width: 60px;
  background: #171D1F;
  border: 1px solid #344143;
  border-radius: 3px;
  color: #E9EFEB;
  padding: 2px 6px;
  font-size: 11px;
  text-align: right;
}

.grid-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #98A6A1;
  margin-top: 6px;
}

.btn-quick-row {
  background-color: #20282A;
  border: 1px solid #344143;
  color: #B9F36B;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
}

/* METADATA FORM */
.field-wrap {
  margin-bottom: 10px;
}

.field-label {
  display: block;
  font-size: 11px;
  color: #98A6A1;
  margin-bottom: 4px;
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  padding: 7px 10px;
  font-size: 12px;
  border-radius: 4px;
}

.text-input:focus {
  outline: none;
  border-color: #B9F36B;
}

.category-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-cat {
  padding: 7px 8px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.btn-cat.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

/* SLICES CONTAINER */
.slices-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 12px;
}

.empty-slices {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #98A6A1;
  gap: 6px;
}

.empty-icon {
  font-size: 32px;
}

.empty-hint {
  font-size: 10px;
  color: #64736f;
}

.anim-preview-box {
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-stage {
  width: 64px;
  height: 64px;
  background-color: #171D1F;
  border: 1px dashed #344143;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

.preview-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-badge {
  font-size: 11px;
  font-weight: 600;
  color: #B9F36B;
}

.playback-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-play-pause {
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  width: 28px;
  height: 28px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.speed-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #98A6A1;
}

.speed-label input {
  width: 80px;
}

/* THUMBNAILS GRID */
.slices-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
  padding-right: 4px;
}

.slice-card {
  background-color: #20282A;
  border: 1px solid #344143;
  border-radius: 5px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: all 0.15s;
}

.slice-card.active {
  border-color: #B9F36B;
  box-shadow: 0 0 8px rgba(185, 243, 107, 0.2);
}

.slice-index-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background-color: #171D1F;
  border: 1px solid #344143;
  color: #B9F36B;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 2px;
}

.slice-thumb-box {
  width: 48px;
  height: 48px;
  margin: 12px 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slice-thumb-img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

.slice-dims {
  font-size: 9px;
  color: #98A6A1;
  margin-bottom: 4px;
}

.slice-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  justify-content: center;
}

.btn-slice-move,
.btn-slice-del {
  background-color: #171D1F;
  border: 1px solid #344143;
  color: #98A6A1;
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 2px;
  cursor: pointer;
}

.btn-slice-move:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-slice-del:hover {
  color: #EF7772;
  border-color: #EF7772;
}

/* ERROR BANNER */
.error-banner {
  margin: 0 18px 10px;
  padding: 8px 12px;
  background-color: rgba(239, 119, 114, 0.15);
  border: 1px solid #EF7772;
  border-radius: 4px;
  color: #EF7772;
  font-size: 11px;
}

/* FOOTER */
.panel-footer {
  height: 60px;
  padding: 0 18px;
  background-color: #20282A;
  border-top: 1px solid #344143;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.btn-cancel:hover {
  background-color: #293335;
  color: #E9EFEB;
}

.btn-create {
  padding: 8px 20px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-create:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 0 12px rgba(185, 243, 107, 0.4);
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
