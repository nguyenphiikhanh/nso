<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fetchSourceAssets } from '../services/project.api'
import type { SourceAsset, SourceAssetPage } from '../types/project'

const props = defineProps<{ selectedId: string | null }>()
const emit = defineEmits<{ select: [asset: SourceAsset]; total: [count: number] }>()
const page = ref<SourceAssetPage | null>(null)
const group = ref('')
const variant = ref('')
const query = ref('')
const offset = ref(0)
const busy = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
const pageNumber = computed(() => Math.floor(offset.value / (page.value?.limit || 60)) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil((page.value?.total || 0) / (page.value?.limit || 60))))

async function load() {
  busy.value = true
  error.value = ''
  try {
    page.value = await fetchSourceAssets({ group: group.value, variant: variant.value, q: query.value, offset: offset.value, limit: 60 })
    emit('total', page.value.groups.reduce((sum, entry) => sum + entry.count, 0))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không đọc được Data/Img.'
  } finally {
    busy.value = false
  }
}

watch([group, variant], () => { offset.value = 0; void load() })
watch(query, () => {
  offset.value = 0
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void load(), 220)
})
onMounted(() => void load())

function selectGroup(value: string) {
  group.value = value
  variant.value = ''
}

function movePage(delta: number) {
  offset.value = Math.max(0, Math.min((pageCount.value - 1) * 60, offset.value + delta * 60))
  void load()
}
</script>

<template>
  <aside class="source-library">
    <header class="panel-heading source-heading">
      <div><span class="eyebrow">PROJECT DATA / IMG</span><h2>Thư viện gốc</h2></div>
      <span class="source-total">{{ page?.groups.reduce((sum, entry) => sum + entry.count, 0).toLocaleString() || '—' }}</span>
    </header>
    <label class="search-box source-search"><span aria-hidden="true">⌕</span><input v-model="query" type="search" placeholder="Tìm tên hoặc ID sprite..." /></label>
    <div class="source-groups" aria-label="Nhóm dữ liệu">
      <button class="source-group-chip" :class="{ active: group === '' }" type="button" @click="selectGroup('')">Tất cả</button>
      <button v-for="entry in page?.groups || []" :key="entry.name" class="source-group-chip" :class="{ active: group === entry.name }" type="button" @click="selectGroup(entry.name)">
        {{ entry.name }} <small>{{ entry.count.toLocaleString() }}</small>
      </button>
    </div>
    <label v-if="group && page?.variants.length" class="source-variant">Biến thể
      <select v-model="variant"><option value="">Tất cả zoom/thư mục</option><option v-for="entry in page.variants" :key="entry" :value="entry">{{ entry }}</option></select>
    </label>
    <div class="source-results-head"><span>PNG <b>{{ page?.total.toLocaleString() || 0 }}</b></span><span>{{ busy ? 'Đang đọc…' : `Trang ${pageNumber}/${pageCount}` }}</span></div>
    <div class="source-asset-list">
      <button v-for="asset in page?.assets || []" :key="asset.id" class="source-asset-row" :class="{ selected: asset.id === selectedId }" type="button" @click="emit('select', asset)">
        <span class="source-thumb checkerboard"><img :src="asset.url" :alt="asset.name" loading="lazy" /></span>
        <span class="asset-copy"><strong>{{ asset.name }}</strong><small>{{ asset.relativePath }}</small></span>
      </button>
      <div v-if="!busy && !error && page?.assets.length === 0" class="empty-library"><strong>Không tìm thấy PNG</strong><span>Thử đổi nhóm, zoom hoặc từ khóa.</span></div>
      <div v-if="error" class="source-error">{{ error }}</div>
      <div v-if="page && !page.rootAvailable" class="source-error">Không tìm thấy Data/Img. Có thể đổi đường dẫn bằng GAME_SOURCE_IMG_DIR.</div>
    </div>
    <footer class="source-pagination">
      <button class="secondary-button" type="button" :disabled="offset === 0 || busy" @click="movePage(-1)">← Trước</button>
      <span>{{ pageNumber }} / {{ pageCount }}</span>
      <button class="secondary-button" type="button" :disabled="!page || offset + page.limit >= page.total || busy" @click="movePage(1)">Sau →</button>
    </footer>
  </aside>
</template>
