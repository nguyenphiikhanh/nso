<script setup lang="ts">
import type { ChangesetSummary } from '../types/nso'
import { revertDraftItem, clearAllDraft } from '../services/nso.api'

const props = defineEmits<{
  (e: 'close'): void
  (e: 'reverted'): void
  (e: 'deploy'): void
}>()

defineProps<{
  summary: ChangesetSummary | null
  deploying: boolean
}>()

async function onRevert(category: string, id: number) {
  try {
    await revertDraftItem(category, id)
    props('reverted')
  } catch (err) {
    console.error('Lỗi hoàn tác:', err)
  }
}

async function onClearAll() {
  if (confirm('Bạn có chắc chắn muốn hủy toàn bộ các thay đổi chưa lưu trong bản nháp?')) {
    try {
      await clearAllDraft()
      props('reverted')
      props('close')
    } catch (err) {
      console.error('Lỗi xóa nháp:', err)
    }
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title-group">
          <h3>Chi Tiết Bản Nháp (Diff & Changeset)</h3>
          <span class="timestamp-sub">Cập nhật lúc: {{ summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : '' }}</span>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body" v-if="summary">
        <div class="backup-notice">
          ℹ️ <strong>Cơ chế An toàn:</strong> Khi bạn bấm <strong>Deploy to Game</strong>, hệ thống sẽ tự động sao lưu toàn bộ file nhị phân Map cũ và câu lệnh SQL đảo ngược vào thư mục <code>backups/</code> trước khi ghi đè.
        </div>

        <!-- Section Maps -->
        <div v-if="summary.changes.maps.length > 0" class="diff-section">
          <h4 class="section-title">🗺️ Bản Đồ ({{ summary.changes.maps.length }})</h4>
          <div class="diff-table">
            <div v-for="m in summary.changes.maps" :key="m.id" class="diff-row">
              <span class="diff-entity-id">#{{ m.id }}</span>
              <span class="diff-entity-name">{{ m.name }}</span>
              <button class="btn-revert" @click="onRevert('maps', m.id)">Hoàn tác</button>
            </div>
          </div>
        </div>

        <!-- Section Items -->
        <div v-if="summary.changes.items.length > 0" class="diff-section">
          <h4 class="section-title">🎒 Vật Phẩm & Thú Cưỡi ({{ summary.changes.items.length }})</h4>
          <div class="diff-table">
            <div v-for="i in summary.changes.items" :key="i.id" class="diff-row">
              <span class="diff-entity-id">#{{ i.id }}</span>
              <span class="diff-entity-name">{{ i.name }} (Type {{ i.type }})</span>
              <button class="btn-revert" @click="onRevert('items', i.id)">Hoàn tác</button>
            </div>
          </div>
        </div>

        <!-- Section Parts -->
        <div v-if="summary.changes.parts.length > 0" class="diff-section">
          <h4 class="section-title">🥋 Part Trang Phục ({{ summary.changes.parts.length }})</h4>
          <div class="diff-table">
            <div v-for="p in summary.changes.parts" :key="p.id" class="diff-row">
              <span class="diff-entity-id">#{{ p.id }}</span>
              <span class="diff-entity-name">Part Loại {{ p.type }}</span>
              <button class="btn-revert" @click="onRevert('parts', p.id)">Hoàn tác</button>
            </div>
          </div>
        </div>

        <!-- Section Monsters -->
        <div v-if="summary.changes.monsters.length > 0" class="diff-section">
          <h4 class="section-title">👾 Quái Vật ({{ summary.changes.monsters.length }})</h4>
          <div class="diff-table">
            <div v-for="mob in summary.changes.monsters" :key="mob.id" class="diff-row">
              <span class="diff-entity-id">#{{ mob.id }}</span>
              <span class="diff-entity-name">{{ mob.name }}</span>
              <button class="btn-revert" @click="onRevert('monsters', mob.id)">Hoàn tác</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-clear-all" @click="onClearAll">Hủy toàn bộ nháp</button>
        <button
          class="btn-confirm-deploy"
          :disabled="deploying || !summary || summary.total === 0"
          @click="$emit('deploy')"
        >
          {{ deploying ? 'Đang Deploy...' : '🚀 XÁC NHẬN DEPLOY TO GAME' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.modal-dialog {
  width: 600px;
  max-width: 95vw;
  max-height: 85vh;
  background-color: #171D1F;
  border: 1px solid #344143;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid #344143;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-title-group h3 {
  margin: 0;
  font-size: 16px;
  color: #E9EFEB;
}

.timestamp-sub {
  font-size: 11px;
  color: #72827e;
}

.btn-close {
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 18px;
  cursor: pointer;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-notice {
  background-color: #20282A;
  border-left: 3px solid #B9F36B;
  padding: 10px 12px;
  font-size: 12px;
  color: #cbd5e1;
  border-radius: 0 4px 4px 0;
}

.diff-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 13px;
  margin: 0;
  color: #B9F36B;
}

.diff-table {
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 4px;
  overflow: hidden;
}

.diff-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.diff-row:last-child {
  border-bottom: none;
}

.diff-entity-id {
  font-family: monospace;
  color: #72827e;
  width: 50px;
}

.diff-entity-name {
  flex: 1;
  color: #E9EFEB;
}

.btn-revert {
  padding: 3px 8px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #EF7772;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}

.btn-revert:hover {
  background-color: #3b1d1f;
}

.modal-footer {
  padding: 14px 16px;
  border-top: 1px solid #344143;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-clear-all {
  padding: 7px 12px;
  background: transparent;
  border: 1px solid #EF7772;
  color: #EF7772;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-confirm-deploy {
  padding: 8px 20px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.btn-confirm-deploy:hover {
  filter: brightness(1.1);
}

.btn-confirm-deploy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
