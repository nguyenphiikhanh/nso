<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NsoPart } from '../../types/nso'
import type { CharacterCategory } from '../../types/character'

const props = defineProps<{
  allParts: NsoPart[]
  selectedHeadId: number
  selectedBodyId: number
  selectedLegId: number
  selectedWeaponId: number
}>()

const emit = defineEmits<{
  (e: 'equip-part', part: NsoPart): void
  (e: 'set-starter'): void
  (e: 'set-sasuke'): void
  (e: 'randomize'): void
  (e: 'open-slicer'): void
}>()

const librarySearch = ref('')
const libraryCategoryFilter = ref<'all' | CharacterCategory>('all')

const headParts = computed(() => props.allParts.filter((p) => p.type === 0))
const bodyParts = computed(() => props.allParts.filter((p) => p.type === 1))
const legParts = computed(() => props.allParts.filter((p) => p.type === 2))
const weaponParts = computed(() => props.allParts.filter((p) => p.type === 3))

const displayedLibraryParts = computed(() => {
  let list = props.allParts
  if (libraryCategoryFilter.value === 'head') list = headParts.value
  else if (libraryCategoryFilter.value === 'body') list = bodyParts.value
  else if (libraryCategoryFilter.value === 'leg') list = legParts.value
  else if (libraryCategoryFilter.value === 'weapon') list = weaponParts.value

  if (librarySearch.value.trim()) {
    const q = librarySearch.value.trim().toLowerCase()
    return list.filter((p) => String(p.id).includes(q))
  }
  return list
})

function getThumb(part: NsoPart): string | null {
  if (!part || !part.part || part.part.length === 0) return null
  const firstImg = part.part[0]
  if (!firstImg || firstImg.id <= 0) return null
  return `/source-media/Small/${firstImg.id}.png`
}
</script>

<template>
  <aside class="char-library">
    <div class="library-header">
      <div class="lib-title-row">
        <h3 class="lib-title">📦 Kho Trang Phục (Parts)</h3>
        <span class="lib-badge">{{ allParts.length }}</span>
      </div>

      <!-- Nút nhập Sprite Sheet mới -->
      <div class="import-action-row">
        <button class="btn-import-sheet" @click="emit('open-slicer')">
          ✂️ Nhập Sprite Sheet Mới
        </button>
      </div>

      <!-- Preset nhanh -->
      <div class="presets-row">
        <button class="btn-preset" @click="emit('set-starter')">Khởi Đầu</button>
        <button class="btn-preset" @click="emit('set-sasuke')">Sasuke</button>
        <button class="btn-preset btn-rnd" @click="emit('randomize')">🎲 Ngẫu Nhiên</button>
      </div>

      <!-- Tìm kiếm theo ID Part -->
      <div class="search-wrap">
        <input
          v-model="librarySearch"
          type="text"
          placeholder="🔍 Tìm Part theo ID..."
          class="search-box"
        />
      </div>
      <div class="category-tabs">
        <button
          class="cat-chip"
          :class="{ active: libraryCategoryFilter === 'all' }"
          @click="libraryCategoryFilter = 'all'"
        >
          Tất cả ({{ allParts.length }})
        </button>
        <button
          class="cat-chip"
          :class="{ active: libraryCategoryFilter === 'head' }"
          @click="libraryCategoryFilter = 'head'"
        >
          🧢 Đầu
        </button>
        <button
          class="cat-chip"
          :class="{ active: libraryCategoryFilter === 'body' }"
          @click="libraryCategoryFilter = 'body'"
        >
          🥋 Thân
        </button>
        <button
          class="cat-chip"
          :class="{ active: libraryCategoryFilter === 'leg' }"
          @click="libraryCategoryFilter = 'leg'"
        >
          👖 Chân
        </button>
        <button
          class="cat-chip"
          :class="{ active: libraryCategoryFilter === 'weapon' }"
          @click="libraryCategoryFilter = 'weapon'"
        >
          ⚔️ Vũ khí
        </button>
      </div>
    </div>

    <!-- Danh sách Parts (Grid thumbnail) -->
    <div class="library-scroll-grid">
      <div
        v-for="p in displayedLibraryParts"
        :key="p.id"
        class="part-grid-card"
        :class="{
          equipped:
            (p.type === 0 && selectedHeadId === p.id) ||
            (p.type === 1 && selectedBodyId === p.id) ||
            (p.type === 2 && selectedLegId === p.id) ||
            (p.type === 3 && selectedWeaponId === p.id),
        }"
        @click="emit('equip-part', p)"
      >
        <div class="card-thumb-frame">
          <img
            :src="getThumb(p)!"
            class="card-sprite-img"
            v-if="getThumb(p)"
          />
          <span v-if="p.isDraft" class="draft-indicator">★</span>
        </div>
        <div class="card-meta">
          <span class="card-title" :title="String((p as any).name || p.id)">{{ (p as any).name || `#${p.id}` }}</span>
          <span v-if="(p as any).isCustom" class="custom-badge">MỚI</span>
          <span v-else class="card-frames-cnt">{{ p.part?.length || 0 }}F</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.char-library {
  width: 260px;
  min-width: 240px;
  border-right: 1px solid var(--color-border, #344143);
  background-color: var(--color-surface, #171D1F);
  display: flex;
  flex-direction: column;
}

.library-header {
  padding: 10px 12px;
  border-bottom: 1px solid #344143;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lib-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lib-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #E9EFEB;
}

.lib-badge {
  font-size: 11px;
  padding: 2px 6px;
  background-color: #20282A;
  border-radius: 4px;
  color: #98A6A1;
}

.presets-row {
  display: flex;
  gap: 4px;
}

.btn-preset {
  flex: 1;
  padding: 4px 6px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-preset:hover {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

.btn-rnd {
  color: #F1A773;
}

.search-wrap {
  width: 100%;
}

.search-box {
  width: 100%;
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  color: #E9EFEB;
  font-size: 11px;
}

.search-box:focus {
  border-color: #B9F36B;
  outline: none;
}

.category-tabs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.cat-chip {
  padding: 3px 6px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #98A6A1;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.cat-chip.active {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
  font-weight: 600;
}

.library-scroll-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  align-content: start;
}

.part-grid-card {
  background-color: #12181A;
  border: 1px solid #283335;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.15s ease;
}

.part-grid-card:hover {
  border-color: #556260;
  background-color: #1B2426;
}

.part-grid-card.equipped {
  border-color: #B9F36B;
  background-color: #1F2E20;
}

.card-thumb-frame {
  height: 52px;
  background-color: #101416;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.card-sprite-img {
  image-rendering: pixelated;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.draft-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #F1A773;
  font-size: 10px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  gap: 4px;
}

.card-title {
  color: #E9EFEB;
  font-weight: 600;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-frames-cnt {
  color: #98A6A1;
  font-size: 9px;
  flex-shrink: 0;
}

.import-action-row {
  margin-top: 2px;
}

.btn-import-sheet {
  width: 100%;
  padding: 6px 10px;
  background-color: #293A21;
  border: 1px solid #B9F36B;
  color: #B9F36B;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn-import-sheet:hover {
  background-color: #B9F36B;
  color: #18210F;
  box-shadow: 0 0 10px rgba(185, 243, 107, 0.3);
}

.custom-badge {
  background-color: #B9F36B;
  color: #18210F;
  font-size: 8px;
  font-weight: 800;
  padding: 1px 3px;
  border-radius: 2px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
</style>
