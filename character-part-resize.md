# Plan: Resize & Copy/Paste Kích Thước Chi Tiết Trang Phục (Character Studio)

> **Mục tiêu:** Bổ sung tính năng thay đổi kích thước (W×H) pixel-perfect (Nearest-Neighbor) cho từng chi tiết/frame trang phục trong Character Studio, kèm hệ thống Clipboard Copy/Paste kích thước giữa các chi tiết hoặc áp dụng đồng loạt cho mọi frame của Part.

---

## 🎯 Chi Tiết Yêu Cầu & Quyết Định Thiết Kế (Đã thống nhất qua Socratic Gate)
1. **Phương án:** Option B (Xử lý trực tiếp trong Inspector Studio khi căn chỉnh trang phục).
2. **Xử lý file ảnh:** Ghi đè trực tiếp lên ảnh Small hiện tại của Part bằng thuật toán Nearest-Neighbor và ghi nhận vào Draft Changeset để có thể Xem Diff / Deploy / Revert.
3. **Tỉ lệ khung hình:** Cho phép chọn linh hoạt: Có nút "Khóa tỉ lệ" (Lock Aspect Ratio) để co dãn đều W/H hoặc mở khóa để nhập tùy ý, phục vụ việc Copy/Paste kích thước giữa các chi tiết khác hình dạng.

---

## 📋 Danh Sách Nhiệm Vụ (Task Breakdown)

### Task 1: Backend Endpoint Cập Nhật & Lưu Ảnh Resized
- **File:** `asset-studio/server/index.mjs`
- **Mô tả:** Thêm API `POST /api/custom-parts/resize-frame`:
  - Nhận `{ smallId, dataUrl, targetW, targetH, partId }`.
  - Ghi buffer base64 ra `Small/${smallId}.png`, `Small${smallId}.png` và `Small/4/Small${smallId}.png`.
  - Cập nhật entity `parts` trong `changesetEngine` để đưa vào danh sách thay đổi (Draft Changeset).
- **Kiểm tra:** Curl test endpoint hoặc gọi từ frontend trả về `{ status: 'ok', smallId, w, h }`.

### Task 2: Service API Client
- **File:** `asset-studio/src/services/nso.api.ts`
- **Mô tả:** Thêm hàm `resizePartFrameImage(payload: { smallId: number; dataUrl: string; targetW: number; targetH: number; partId?: number })`.

### Task 3: Bộ Công Cụ Resize & Clipboard Trong CharacterInspector
- **File:** `asset-studio/src/components/character/CharacterInspector.vue`
- **Mô tả:**
  - Thêm state `isRatioLocked` (mặc định bật), `sizeClipboard` (`{ w: number; h: number }`).
  - Thêm cụm giao diện "📐 Kích Thước & Tỉ Lệ (Pixel Art)" trong thẻ chi tiết frame:
    - Input `Rộng (W)` và `Cao (H)`.
    - Nút toggle `🔒 Khóa tỉ lệ` (Lock Ratio).
    - Presets tỉ lệ nhanh: `-25%`, `+25%`, `50%`, `100%`, `150%`, `200%`.
    - Nút `📋 Copy Cỡ (W×H)` và `📌 Dán Cỡ`.
    - Nút `⚡ Dán Cho Tất Cả Frame Của Part`.
  - Hàm Resample bằng Offscreen `<canvas>` (`ctx.imageSmoothingEnabled = false`):
    - Tải ảnh gốc từ `/source-media/Small/${frame.id}.png`.
    - Vẽ lên canvas đích với kích thước mới (Nearest-Neighbor chuẩn NSO pixel art).
    - Xuất dataUrl và emit event lên parent.

### Task 4: Đồng Bộ Kích Thước & Xem Trước Thời Gian Thực Trên Stage
- **Files:** `asset-studio/src/components/CharacterStudio.vue`, `asset-studio/src/components/character/CharacterStage.vue`
- **Mô tả:**
  - `CharacterStudio.vue`: Lắng nghe sự kiện resize từ Inspector, cập nhật `spriteDimensions.value[smallId] = { w, h }`, gọi API lưu ảnh mới và cập nhật trạng thái Part draft.
  - `CharacterStage.vue`: Hỗ trợ style kích thước động trên thẻ `<img>` với class `pixel-img`, đảm bảo hình ảnh hiển thị đúng W×H mới ngay tức thì.

### Task 5: Kiểm Tra & Build Xác Thực
- **Lệnh:** `npm run build` (`vue-tsc --noEmit && vite build`).
- **Mục tiêu:** 0 lỗi compile, dev server phản hồi HTTP 200, giao diện ăn khớp hoàn toàn với DESIGN.md.
