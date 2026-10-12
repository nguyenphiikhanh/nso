<script setup lang="ts">
import { ref } from 'vue'
import { exportPackage } from '../services/nso.api'

defineEmits<{
  (e: 'close'): void
}>()

const target = ref<'server' | 'unity' | 'modpack'>('unity')
const exporting = ref(false)
const downloadUrl = ref<string | null>(null)
const downloadFilename = ref<string | null>(null)
const errorMessage = ref('')

async function startExport() {
  exporting.value = true
  errorMessage.value = ''
  downloadUrl.value = null

  try {
    const res = await exportPackage({ target: target.value })
    if (res.success && res.downloadUrl) {
      downloadUrl.value = res.downloadUrl
      downloadFilename.value = res.filename

      // Tự động kích hoạt tải xuống
      const link = document.createElement('a')
      link.href = res.downloadUrl
      link.download = res.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Lỗi khi đóng gói xuất dữ liệu.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Xuất Dữ Liệu Đa Nền Tảng (Multi-Target Exporter)</h3>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <label class="section-label">Chọn Định Dạng Mục Tiêu (Target Profile):</label>
        
        <div class="target-options-grid">
          <!-- Option 1: Unity C# Client Bundle -->
          <div
            class="target-card"
            :class="{ active: target === 'unity' }"
            @click="target = 'unity'"
          >
            <div class="card-icon">🎮</div>
            <div class="card-text">
              <span class="card-title">Unity C# Client Bundle</span>
              <span class="card-desc">
                Xuất cấu trúc thư mục <code>Assets/Resources/...</code>, file JSON Animation và script C#
                <code>NsoAnimationPlayer.cs</code> để chạy hoạt ảnh mượt mà trên Unity.
              </span>
            </div>
          </div>

          <!-- Option 2: NSO Java Server Package -->
          <div
            class="target-card"
            :class="{ active: target === 'server' }"
            @click="target = 'server'"
          >
            <div class="card-icon">🖥️</div>
            <div class="card-text">
              <span class="card-title">NSO Java Server Package</span>
              <span class="card-desc">
                Xuất các file nhị phân <code>Data/Map/{id}</code> và file <code>patch_migration.sql</code>
                để chạy trực tiếp vào VPS hoặc Server NSO khác.
              </span>
            </div>
          </div>

          <!-- Option 3: Universal ModPack -->
          <div
            class="target-card"
            :class="{ active: target === 'modpack' }"
            @click="target = 'modpack'"
          >
            <div class="card-icon">📦</div>
            <div class="card-text">
              <span class="card-title">Universal Studio ModPack (.zip)</span>
              <span class="card-desc">
                Gói đóng gói trọn vẹn kèm <code>manifest.json</code> để lưu trữ phiên bản hoặc chia sẻ
                sang máy khác có thể Import lại vào Studio.
              </span>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="error-msg">
          ❌ {{ errorMessage }}
        </div>

        <div v-if="downloadUrl" class="success-box">
          ✅ Đã đóng gói thành công file: <strong>{{ downloadFilename }}</strong>
          <br />
          <a :href="downloadUrl" class="download-link" download>Bấm vào đây nếu trình duyệt không tự tải</a>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Đóng</button>
        <button class="btn-submit" :disabled="exporting" @click="startExport">
          {{ exporting ? 'Đang đóng gói ZIP...' : '🚀 BẮT ĐẦU XUẤT GÓI' }}
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
  width: 580px;
  max-width: 95vw;
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
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  color: #E9EFEB;
}

.btn-close {
  background: transparent;
  border: none;
  color: #98A6A1;
  font-size: 18px;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-label {
  font-size: 12px;
  color: #98A6A1;
  font-weight: 600;
}

.target-options-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.target-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: #101416;
  border: 1px solid #344143;
  border-radius: 6px;
  cursor: pointer;
}

.target-card:hover {
  background-color: #20282A;
}

.target-card.active {
  border-color: #B9F36B;
  background-color: #293A21;
}

.card-icon {
  font-size: 24px;
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  color: #E9EFEB;
}

.card-desc {
  font-size: 11px;
  color: #98A6A1;
  line-height: 1.4;
}

.card-desc code {
  color: #B9F36B;
}

.error-msg {
  background-color: #381e28;
  color: #f43f5e;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.success-box {
  background-color: #293A21;
  color: #B9F36B;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.download-link {
  color: #E9EFEB;
  text-decoration: underline;
  margin-top: 4px;
  display: inline-block;
}

.modal-footer {
  padding: 14px 16px;
  border-top: 1px solid #344143;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  padding: 7px 14px;
  background-color: #20282A;
  border: 1px solid #344143;
  color: #E9EFEB;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-submit {
  padding: 8px 20px;
  background-color: #B9F36B;
  color: #18210F;
  border: none;
  border-radius: 4px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
