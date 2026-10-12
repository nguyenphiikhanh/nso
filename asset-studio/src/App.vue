<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MapStudio from './components/MapStudio.vue'
import ItemMountStudio from './components/ItemMountStudio.vue'
import CharacterStudio from './components/CharacterStudio.vue'
import SpriteAnimationStudio from './components/SpriteAnimationStudio.vue'
import DraftBar from './components/DraftBar.vue'
import DiffDeployModal from './components/DiffDeployModal.vue'
import ExportModal from './components/ExportModal.vue'
import { fetchDraftSummary, deployDraftToGame, checkDbStatus } from './services/nso.api'
import type { ChangesetSummary } from './types/nso'

type StudioTab = 'map' | 'item' | 'character' | 'sprite'
const activeTab = ref<StudioTab>('map')

const draftSummary = ref<ChangesetSummary | null>(null)
const isDeploying = ref(false)
const showDiffModal = ref(false)
const showExportModal = ref(false)
const isDbConnected = ref(false)
const toastMessage = ref<string | null>(null)

async function refreshDraft() {
  try {
    draftSummary.value = await fetchDraftSummary()
  } catch (err) {
    console.error('Lỗi lấy summary nháp:', err)
  }
}

async function handleDeploy() {
  if (!confirm('Bạn có chắc chắn muốn Áp dụng (Deploy) toàn bộ thay đổi vào Game? Hệ thống sẽ tự động sao lưu dữ liệu cũ.')) {
    return
  }

  isDeploying.value = true
  try {
    const res = await deployDraftToGame()
    showDiffModal.value = false
    await refreshDraft()
    showToast(`🚀 Đã Deploy thành công! Sao lưu tại: ${res.backupPath.split('/').slice(-2).join('/')}`)
  } catch (err: any) {
    alert(`Lỗi Deploy: ${err.message}`)
  } finally {
    isDeploying.value = false
  }
}

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = null
  }, 4500)
}

onMounted(async () => {
  await refreshDraft()
  const db = await checkDbStatus()
  isDbConnected.value = db.connected
})
</script>

<template>
  <div class="studio-app">
    <!-- Top Navigation Bar -->
    <header class="app-header">
      <div class="brand-area">
        <span class="brand-icon">⚡</span>
        <div class="brand-titles">
          <span class="brand-name">NSO ASSET STUDIO</span>
          <span class="brand-subtitle">Java Server & Unity C# Client Workbench</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button
          class="nav-tab"
          :class="{ active: activeTab === 'map' }"
          @click="activeTab = 'map'"
        >
          🗺️ Bản Đồ (Map)
        </button>
        <button
          class="nav-tab"
          :class="{ active: activeTab === 'item' }"
          @click="activeTab = 'item'"
        >
          🎒 Vật Phẩm & Thú Cưỡi
        </button>
        <button
          class="nav-tab"
          :class="{ active: activeTab === 'character' }"
          @click="activeTab = 'character'"
        >
          🥋 Nhân Vật & Part
        </button>
        <button
          class="nav-tab"
          :class="{ active: activeTab === 'sprite' }"
          @click="activeTab = 'sprite'"
        >
          🎬 Quái Vật & Animation
        </button>
      </nav>

      <!-- Right Action Bar -->
      <div class="header-actions">
        <!-- DB Status -->
        <div class="status-indicator" :class="{ online: isDbConnected }">
          <span class="status-dot" />
          <span class="status-text">{{ isDbConnected ? 'MariaDB Connected' : 'DB Disconnected' }}</span>
        </div>

        <!-- Export Package -->
        <button class="btn-export-pkg" @click="showExportModal = true">
          📦 Xuất Gói Đa Nền Tảng
        </button>
      </div>
    </header>

    <!-- Main Workspace Area -->
    <div class="workspace-area">
      <MapStudio
        v-if="activeTab === 'map'"
        @draft-updated="refreshDraft"
      />
      <ItemMountStudio
        v-else-if="activeTab === 'item'"
        @draft-updated="refreshDraft"
      />
      <CharacterStudio
        v-else-if="activeTab === 'character'"
        @draft-updated="refreshDraft"
      />
      <SpriteAnimationStudio
        v-else-if="activeTab === 'sprite'"
        @draft-updated="refreshDraft"
      />
    </div>

    <!-- Floating Draft Status Bar -->
    <DraftBar
      :summary="draftSummary"
      :deploying="isDeploying"
      @open-diff="showDiffModal = true"
      @deploy="handleDeploy"
    />

    <!-- Modals -->
    <DiffDeployModal
      v-if="showDiffModal"
      :summary="draftSummary"
      :deploying="isDeploying"
      @close="showDiffModal = false"
      @reverted="refreshDraft"
      @deploy="handleDeploy"
    />

    <ExportModal
      v-if="showExportModal"
      @close="showExportModal = false"
    />

    <!-- Toast Notification -->
    <div v-if="toastMessage" class="toast-popup">
      {{ toastMessage }}
    </div>
  </div>
</template>

<style scoped>
.studio-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-canvas, #101416);
  color: var(--color-text, #E9EFEB);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.app-header {
  height: 52px;
  background-color: var(--color-surface, #171D1F);
  border-bottom: 1px solid var(--color-border, #344143);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  user-select: none;
  z-index: 100;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  font-size: 20px;
}

.brand-titles {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #B9F36B;
}

.brand-subtitle {
  font-size: 9px;
  color: #98A6A1;
}

.nav-tabs {
  display: flex;
  gap: 6px;
  height: 100%;
  align-items: flex-end;
}

.nav-tab {
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #98A6A1;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.nav-tab:hover {
  color: #E9EFEB;
  background-color: #20282A;
  border-radius: 4px 4px 0 0;
}

.nav-tab.active {
  color: #B9F36B;
  border-bottom-color: #B9F36B;
  background-color: #20282A;
  border-radius: 4px 4px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #EF7772;
}

.status-indicator.online {
  color: #B9F36B;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: currentColor;
}

.btn-export-pkg {
  padding: 6px 14px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-export-pkg:hover {
  background-color: #293A21;
  border-color: #B9F36B;
  color: #B9F36B;
}

.workspace-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.toast-popup {
  position: fixed;
  top: 64px;
  right: 20px;
  background-color: #293A21;
  border: 1px solid #B9F36B;
  color: #B9F36B;
  padding: 12px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  z-index: 3000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
