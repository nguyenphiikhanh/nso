<script setup lang="ts">
import type { ChangesetSummary } from '../types/nso'

defineProps<{
  summary: ChangesetSummary | null
  deploying: boolean
}>()

const emit = defineEmits<{
  (e: 'open-diff'): void
  (e: 'deploy'): void
}>()
</script>

<template>
  <div v-if="summary && summary.total > 0" class="draft-floating-bar">
    <div class="draft-badge-info">
      <span class="warning-icon">⚠️</span>
      <span class="draft-count-text">
        Bạn có <strong>{{ summary.total }}</strong> thay đổi trong Bản Nháp chưa lưu vào game:
      </span>
      <div class="change-tags">
        <span v-if="summary.counts.maps > 0" class="tag map-tag">
          {{ summary.counts.maps }} Map
        </span>
        <span v-if="summary.counts.items > 0" class="tag item-tag">
          {{ summary.counts.items }} Item/Thú
        </span>
        <span v-if="summary.counts.parts > 0" class="tag part-tag">
          {{ summary.counts.parts }} Part
        </span>
        <span v-if="summary.counts.monsters > 0" class="tag mob-tag">
          {{ summary.counts.monsters }} Quái
        </span>
      </div>
    </div>

    <div class="draft-actions">
      <button class="btn-review" @click="emit('open-diff')">
        🔍 Xem Diff Chi Tiết
      </button>
      <button class="btn-deploy" :disabled="deploying" @click="emit('deploy')">
        {{ deploying ? 'Đang Deploy...' : '🚀 DEPLOY TO GAME (Áp dụng)' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.draft-floating-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #171D1F;
  border: 1px solid #B9F36B;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 20px;
  z-index: 1000;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

.draft-badge-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.warning-icon {
  font-size: 16px;
}

.draft-count-text {
  font-size: 13px;
  color: #E9EFEB;
}

.change-tags {
  display: flex;
  gap: 6px;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.map-tag {
  background-color: #293A21;
  color: #B9F36B;
}

.item-tag {
  background-color: #3b2c1a;
  color: #F1A773;
}

.part-tag {
  background-color: #1b2e35;
  color: #38bdf8;
}

.mob-tag {
  background-color: #381e28;
  color: #f43f5e;
}

.draft-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-review {
  padding: 6px 12px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-review:hover {
  background-color: #293335;
}

.btn-deploy {
  padding: 7px 16px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn-deploy:hover {
  filter: brightness(1.1);
}

.btn-deploy:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
