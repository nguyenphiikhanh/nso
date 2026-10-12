<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { NsoItem, NsoItemOptionTemplate } from '../types/nso'
import {
  fetchItemsList,
  fetchItemDetail,
  saveItemDraft,
  fetchItemOptions,
} from '../services/nso.api'

const emit = defineEmits<{
  (e: 'draft-updated'): void
}>()

const activeTab = ref<'mounts' | 'all'>('mounts')
const items = ref<NsoItem[]>([])
const selectedItem = ref<NsoItem | null>(null)
const optionTemplates = ref<NsoItemOptionTemplate[]>([])
const searchQuery = ref('')
const totalItems = ref(0)
const currentPage = ref(0)
const pageSize = 40
const loading = ref(false)
const saving = ref(false)

const itemTypeNames: Record<number, string> = {
  0: 'Nón',
  1: 'Vũ khí',
  2: 'Áo',
  3: 'Dây chuyền',
  4: 'Găng tay',
  5: 'Nhẫn',
  6: 'Quần',
  7: 'Ngọc bội',
  8: 'Giày',
  9: 'Bùa phù',
  10: 'Thú nuôi',
  11: 'Mặt nạ',
  12: 'Áo choàng',
  13: 'Bao tay',
  14: 'Mắt thần',
  15: 'Bí kíp',
  16: 'Bình HP',
  17: 'Bình MP',
  18: 'Thức ăn',
  26: 'Đá nâng cấp',
  27: 'Vật phẩm khác',
  29: 'Thú cưỡi 0 (Sói/Ngựa/Xe)',
  30: 'Thú cưỡi 1 (Yên cương)',
  31: 'Thú cưỡi 2 (Dây cương)',
  32: 'Thú cưỡi 3 (Móng sắt)',
  33: 'Thú cưỡi 4 (Thú chính)',
  34: 'Ngọc khảm',
}

async function loadItems() {
  loading.value = true
  try {
    const res = await fetchItemsList({
      isMount: activeTab.value === 'mounts',
      q: searchQuery.value,
      offset: currentPage.value * pageSize,
      limit: pageSize,
    })
    items.value = res.items
    totalItems.value = res.total
    if (items.value.length > 0 && !selectedItem.value) {
      selectItem(items.value[0].id)
    }
  } catch (err) {
    console.error('Lỗi tải danh sách item:', err)
  } finally {
    loading.value = false
  }
}

async function selectItem(id: number) {
  try {
    selectedItem.value = await fetchItemDetail(id)
  } catch (err) {
    console.error('Lỗi tải chi tiết item:', err)
  }
}

async function saveCurrentItemDraft() {
  if (!selectedItem.value) return
  saving.value = true
  try {
    await saveItemDraft(selectedItem.value.id, selectedItem.value)
    selectedItem.value.isDraft = true
    const found = items.value.find((i) => i.id === selectedItem.value!.id)
    if (found) found.isDraft = true
    emit('draft-updated')
  } catch (err) {
    console.error('Lỗi lưu nháp item:', err)
  } finally {
    saving.value = false
  }
}

function changeTab(tab: 'mounts' | 'all') {
  activeTab.value = tab
  currentPage.value = 0
  selectedItem.value = null
  loadItems()
}

function onSearch() {
  currentPage.value = 0
  loadItems()
}

function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--
    loadItems()
  }
}

function nextPage() {
  if ((currentPage.value + 1) * pageSize < totalItems.value) {
    currentPage.value++
    loadItems()
  }
}

onMounted(() => {
  loadItems()
  fetchItemOptions()
    .then((opts) => (optionTemplates.value = opts))
    .catch(() => {})
})
</script>

<template>
  <div class="item-studio">
    <!-- Left Panel: Danh sách Item & Thú Cưỡi -->
    <aside class="item-sidebar">
      <!-- Tabs Chuyển đổi -->
      <div class="tab-header">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'mounts' }"
          @click="changeTab('mounts')"
        >
          🐴 Thú Cưỡi (type 29..33)
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'all' }"
          @click="changeTab('all')"
        >
          🎒 Tất cả Item
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="search-section">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm ID hoặc tên..."
          class="input-search"
          @keyup.enter="onSearch"
        />
        <button class="btn-search" @click="onSearch">🔍</button>
      </div>

      <!-- List -->
      <div class="item-list">
        <div v-if="loading" class="list-empty">Đang tải danh sách...</div>
        <button
          v-for="item in items"
          :key="item.id"
          class="item-row"
          :class="{ active: selectedItem?.id === item.id, 'is-draft': item.isDraft }"
          @click="selectItem(item.id)"
        >
          <img
            :src="`/source-media/Small/${item.icon}.png`"
            class="item-icon-small"
            @error="(e) => ((e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')"
          />
          <div class="item-info">
            <span class="item-title">{{ item.name }}</span>
            <span class="item-subtitle">#{{ item.id }} • {{ itemTypeNames[item.type] || `Type ${item.type}` }}</span>
          </div>
          <span v-if="item.isDraft" class="draft-badge">Nháp</span>
        </button>
      </div>

      <!-- Pagination -->
      <div class="pagination-footer">
        <button class="page-btn" :disabled="currentPage === 0" @click="prevPage">◀</button>
        <span class="page-info">
          {{ currentPage * pageSize + 1 }}-{{ Math.min((currentPage + 1) * pageSize, totalItems) }} / {{ totalItems }}
        </span>
        <button
          class="page-btn"
          :disabled="(currentPage + 1) * pageSize >= totalItems"
          @click="nextPage"
        >
          ▶
        </button>
      </div>
    </aside>

    <!-- Center Workspace: Chi tiết Item & Chỉnh sửa Thú Cưỡi -->
    <main class="item-detail-view" v-if="selectedItem">
      <div class="detail-topbar">
        <div class="title-with-badge">
          <h2>{{ selectedItem.name }} (ID #{{ selectedItem.id }})</h2>
          <span v-if="selectedItem.type >= 29 && selectedItem.type <= 33" class="mount-tag">
            🌟 THÚ CƯỠI NSO
          </span>
          <span v-if="selectedItem.isDraft" class="draft-tag">Bản Nháp Chưa Lưu</span>
        </div>
        <button class="btn-save-draft" :disabled="saving" @click="saveCurrentItemDraft">
          {{ saving ? 'Đang lưu...' : '💾 Lưu Vào Bản Nháp' }}
        </button>
      </div>

      <div class="detail-content-grid">
        <!-- Cột 1: Preview Icon & Thuộc tính cơ bản -->
        <div class="panel-card">
          <h3 class="panel-heading">Hình ảnh & Định danh</h3>
          <div class="icon-preview-box">
            <div class="icon-preview-frame">
              <img
                :src="`/source-media/Small/${selectedItem.icon}.png`"
                class="icon-large"
                @error="(e) => ((e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')"
              />
            </div>
            <div class="icon-controls">
              <label>Icon ID (Data/Img/Small):</label>
              <input v-model.number="selectedItem.icon" type="number" class="input-text" />
            </div>
          </div>

          <div class="form-group">
            <label>Tên vật phẩm:</label>
            <input v-model="selectedItem.name" type="text" class="input-text" />
          </div>

          <div class="form-group">
            <label>Mô tả vật phẩm:</label>
            <textarea v-model="selectedItem.description" rows="3" class="input-textarea" />
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Loại (Type):</label>
              <select v-model.number="selectedItem.type" class="input-select">
                <option v-for="(name, tId) in itemTypeNames" :key="tId" :value="Number(tId)">
                  {{ tId }} - {{ name }}
                </option>
              </select>
            </div>
            <div class="form-group half">
              <label>Giới tính:</label>
              <select v-model.number="selectedItem.gender" class="input-select">
                <option :value="2">Tất cả (2)</option>
                <option :value="1">Nam (1)</option>
                <option :value="0">Nữ (0)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Cấp độ yêu cầu:</label>
              <input v-model.number="selectedItem.level" type="number" class="input-text" />
            </div>
            <div class="form-group half">
              <label>Part ID (nj_part):</label>
              <input v-model.number="selectedItem.part" type="number" class="input-text" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Fashion ID:</label>
              <input v-model.number="selectedItem.fashion" type="number" class="input-text" />
            </div>
            <div class="form-group half checkbox-group">
              <label>
                <input v-model="selectedItem.isUpToUp" type="checkbox" />
                Xếp chồng được (isUpToUp)
              </label>
            </div>
          </div>
        </div>

        <!-- Cột 2: Cấu hình Thú Cưỡi & Chỉ số Options -->
        <div class="panel-card" v-if="selectedItem.type >= 29 && selectedItem.type <= 33">
          <h3 class="panel-heading">Cấu hình Thú Cưỡi (Mount Profile)</h3>
          <div class="mount-helper-box">
            <p class="helper-text">
              Thú cưỡi chính sử dụng <code>type 33</code>. Khi nhân vật sử dụng, server Java nạp qua
              <code>loadMount()</code> và tính điểm thuộc tính nâng cấp qua <code>fixMountOption()</code>.
            </p>
          </div>

          <div class="form-group">
            <label>Mẫu Thú cưỡi nhận diện:</label>
            <div class="quick-preset-badges">
              <span class="badge-preset" @click="selectedItem.level = 50">Cấp 50 (Chuẩn)</span>
              <span class="badge-preset" @click="selectedItem.level = 40">Cấp 40</span>
              <span class="badge-preset" @click="selectedItem.isUpToUp = false">Khóa Xếp Chồng</span>
            </div>
          </div>

          <div class="form-group">
            <label>Hệ thống Options hỗ trợ Thú cưỡi trong Java:</label>
            <div class="mount-options-list">
              <div class="mount-opt-row">
                <span class="opt-name">Option 6 / 7</span>
                <span class="opt-desc">HP tối đa / MP tối đa (+50)</span>
              </div>
              <div class="mount-opt-row">
                <span class="opt-name">Option 10</span>
                <span class="opt-desc">Chính xác (+10)</span>
              </div>
              <div class="mount-opt-row">
                <span class="opt-name">Option 67 / 68</span>
                <span class="opt-desc">Kháng hỏa / Băng (+5)</span>
              </div>
              <div class="mount-opt-row">
                <span class="opt-name">Option 73 / 74</span>
                <span class="opt-desc">Tấn công khi đánh chí mạng (+100)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.item-studio {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--color-canvas, #101416);
  color: var(--color-text, #E9EFEB);
}

.item-sidebar {
  width: 320px;
  border-right: 1px solid var(--color-border, #344143);
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface, #171D1F);
}

.tab-header {
  display: flex;
  border-bottom: 1px solid var(--color-border, #344143);
}

.tab-btn {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: #B9F36B;
  border-bottom-color: #B9F36B;
  background-color: #20282A;
}

.search-section {
  display: flex;
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid #344143;
}

.input-search {
  flex: 1;
  padding: 6px 8px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
}

.btn-search {
  padding: 0 10px;
  background: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  cursor: pointer;
}

.item-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.item-row {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  gap: 10px;
}

.item-row:hover {
  background-color: #20282A;
}

.item-row.active {
  background-color: #293A21;
}

.item-icon-small {
  width: 28px;
  height: 28px;
  image-rendering: pixelated;
  object-fit: contain;
  background-color: #101416;
  border-radius: 3px;
  padding: 2px;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.item-title {
  font-size: 12px;
  font-weight: 600;
  color: #E9EFEB;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-subtitle {
  font-size: 10px;
  color: #72827e;
}

.draft-badge {
  font-size: 9px;
  background-color: #F1A773;
  color: #18210F;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.pagination-footer {
  height: 40px;
  border-top: 1px solid #344143;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
}

.page-btn {
  padding: 4px 8px;
  background: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 3px;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 11px;
  color: #98A6A1;
}

.item-detail-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background-color: #0c0f11;
  padding: 20px;
}

.detail-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-with-badge h2 {
  font-size: 18px;
  margin: 0;
}

.mount-tag {
  font-size: 11px;
  background-color: #293A21;
  color: #B9F36B;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.draft-tag {
  font-size: 11px;
  background-color: #F1A773;
  color: #18210F;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.btn-save-draft {
  padding: 8px 16px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

.detail-content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.panel-card {
  background-color: var(--color-surface, #171D1F);
  border: 1px solid var(--color-border, #344143);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-heading {
  font-size: 14px;
  margin: 0 0 6px 0;
  color: #B9F36B;
  border-bottom: 1px solid #344143;
  padding-bottom: 8px;
}

.icon-preview-box {
  display: flex;
  gap: 16px;
  align-items: center;
  background-color: #101416;
  padding: 12px;
  border-radius: 4px;
}

.icon-preview-frame {
  width: 64px;
  height: 64px;
  background-color: #171D1F;
  border: 1px solid #344143;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.icon-large {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
  object-fit: contain;
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
  gap: 12px;
}

.form-row .half {
  flex: 1;
}

.checkbox-group {
  justify-content: center;
}

.checkbox-group label {
  color: #E9EFEB;
  cursor: pointer;
}

.input-text, .input-select, .input-textarea {
  padding: 7px 10px;
  background-color: #101416;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
}

.mount-helper-box {
  background-color: #20282A;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #cbd5e1;
}

.quick-preset-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.badge-preset {
  font-size: 11px;
  background-color: #20282A;
  border: 1px solid #344143;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.badge-preset:hover {
  background-color: #293A21;
  color: #B9F36B;
}

.mount-options-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mount-opt-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: #101416;
  border-radius: 4px;
  font-size: 12px;
}

.opt-name {
  color: #B9F36B;
  font-family: monospace;
}

.opt-desc {
  color: #98A6A1;
}
</style>
