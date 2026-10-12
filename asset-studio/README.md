# Game Asset Studio

Công cụ local để tạo và chỉnh nội dung cho game 2D mới. Frontend dùng Vue 3 + Vite; API và lưu file dùng Node.js + Express. Tool chạy độc lập với server Java trong repository.

## Bắt đầu

Yêu cầu Node.js 20.19+ hoặc 22.12+.

```sh
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, mặc định `http://127.0.0.1:5173`. API chạy ở cổng `3001`.

Build và chạy bản production:

```sh
npm run build
npm start
```

## Project data

Mặc định project được tạo tại `projects/default/`:

```text
projects/default/
├── project.json
└── assets/       # PNG đã import
```

Đổi thư mục project bằng biến môi trường `GAME_PROJECT_DIR`. Đường dẫn tương đối tính từ thư mục `asset-studio`.

```powershell
$env:GAME_PROJECT_DIR = "D:\GameProjects\my-new-game"
npm run dev
```

Mặc định thư viện **Data gốc** đọc PNG trực tiếp từ `../Data/Img` của repository (không sao chép hàng chục nghìn file vào project). Có thể đổi nguồn bằng `GAME_SOURCE_IMG_DIR`. Thư viện hỗ trợ tìm kiếm, lọc theo nhóm/zoom và phân trang; nhóm hiện có gồm `Map`, `Mob`, `Object`, `Small`, `Effect`, `EffectAuto`.

Tool đọc thông tin MariaDB từ service `mariadb` trong `../docker-compose.yml`. Để xem metadata crop/frame/animation, khởi động database bằng `docker compose up -d mariadb`; API chỉ chạy các truy vấn đọc cố định cho `monster`, `effect_data` và `effect_data_auto`. Có thể ghi đè kết nối bằng `ASSET_STUDIO_DB_HOST`, `ASSET_STUDIO_DB_PORT`, `ASSET_STUDIO_DB_NAME`, `ASSET_STUDIO_DB_USER`, `ASSET_STUDIO_DB_PASSWORD`; khi chạy Node trong cùng compose network, đặt `ASSET_STUDIO_IN_DOCKER=1` để dùng hostname `mariadb`.

Các script Node nạp `asset-studio/.env.local` nếu file tồn tại. File này đã được gitignore, dùng để giữ cấu hình local mà không commit credential.

Project JSON lưu map theo lưới tile và metadata asset. Ảnh PNG được lưu riêng trong `assets/` rồi được tham chiếu bằng đường dẫn `/media/...`. Nút Export JSON chỉ xuất metadata và map; để mang toàn bộ project sang máy khác, hãy chép cả file JSON lẫn thư mục `assets/`.

## MVP hiện có

- Tạo, đổi tên, xóa map dạng tile/sprite; chỉnh kích thước lưới, chọn tile, tô bằng chuột, tẩy và zoom.
- Tạo, sửa và xóa tile, vật phẩm, nhân vật, trang phục, thú cưỡi.
- Import PNG tối đa 10 MB cho một asset và xem trước với nearest-neighbor scaling.
- Duyệt PNG nguồn trong `Data/Img`; mở sprite để xem/chỉnh pixel bằng bút, tẩy, màu, zoom, lưới, undo/redo; lưu bản PNG mới vào project, không ghi đè ảnh nguồn.
- Xem crop frame và sequence metadata từ MariaDB khi database có thể kết nối.
- Lưu tự động vào project JSON; có nút lưu, import và export JSON.
- Phím tắt map: `B` chọn bút, `E` chọn tẩy, `Ctrl/Cmd + S` lưu.

Map project mới hiện lưu một lớp tile. Metadata chi tiết của map nhị phân trong `Data/Map` và các bảng khác chưa được chuyển đổi vào schema project mới. Tool chưa có layer map, collision brush, xuất gói ZIP hoặc nhiều người chỉnh sửa đồng thời. Ảnh upload được xác nhận theo MIME type và phần mở rộng `.png` do client gửi; backend local chỉ nên được dùng bởi người dùng tin cậy.
