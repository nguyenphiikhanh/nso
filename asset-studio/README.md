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

## Tính năng Hoàn thiện cho NSO (Server Java & Unity C# Client)

1. **🗺️ Map Studio (Bản đồ Nhị phân Chuẩn NSO)**:
   - Đọc và ghi trực tiếp 179 file nhị phân `Data/Map/{id}` (`TileMap.java`: `tmw`, `tmh`, tile index mảng 1 chiều có giải mã signed key offset).
   - Render tile 24x24 px (Nearest-Neighbor) từ tileset `Data/Img/Map/{zoom}/tile/{tileId}.png` và background `bg/{bgId}.png`.
   - Đặt thực thể trực quan kéo thả: NPC, Waypoint (cổng chuyển map), Điểm Spawn Quái vật, vùng đứng chân `locationStand`.

2. **🎒 Item & Thú Cưỡi Manager (Items & Mounts)**:
   - Quản lý danh mục 1,240 vật phẩm trong bảng `item` và `item_option`.
   - Phân hệ chuyên sâu cho Thú cưỡi (Mounts - type 29..33: Sói, Xe máy, Harley Davidson, Trâu, Hổ, Phượng hoàng băng, Hỏa Kỳ Lân...).
   - Xem icon phóng to trực tiếp từ `Data/Img/Small/{icon}.png`, sửa tên, cấp độ yêu cầu, options chỉ số.

3. **🥋 Character & Part Studio (Avatar Composer)**:
   - Quản lý các bộ part từ bảng `nj_part`: Nón/Đầu (Type 0), Thân/Áo (Type 1), Chân/Quần (Type 2), Vũ khí (Type 3).
   - Lắp ráp avatar và xem trước chuyển động thời gian thực: Đứng yên (Idle), Chạy bộ (Run), Tấn công (Attack).
   - Tinh chỉnh offset `dx`, `dy` của từng frame part trực quan.

4. **🎬 Quái Vật & Sprite Animation**:
   - Quản lý metadata Quái vật (`monster`) và Hiệu ứng (`effect_data`).
   - Slicer cắt lát tọa độ (`sprites`: x, y, w, h), Assembler ghép frame (`frames`: dx, dy, flip, onTop) và Sequence timeline player.

5. **⚡ Snapshot Changeset Engine (Draft & Review)**:
   - Cơ chế lưu nháp an toàn: Mọi thao tác chỉnh sửa không làm biến đổi file gốc ngay mà được lưu vào bản nháp.
   - Thanh trạng thái nổi góc dưới cho biết số lượng thay đổi chưa lưu, kèm hộp thoại **Xem Diff**.
   - Nút **Deploy to Game**: Ghi đè an toàn vào `Data/Map/` và MariaDB với cơ chế tự động sao lưu bản cũ vào `backups/`.

6. **📦 Xuất Gói Đa Nền Tảng (Multi-Target Exporter)**:
   - **Target 1: NSO Java Server**: Xuất thư mục `Data/Map/` nhị phân và file `patch_migration.sql`.
   - **Target 2: Unity C# Client**: Xuất cấu trúc thư mục `Assets/Resources/...`, sinh file JSON Animation và script C# mẫu `NsoAnimationPlayer.cs` kéo thả là chạy mượt trên Unity.
   - **Target 3: Universal Studio ModPack**: Xuất file `.zip` kèm `manifest.json` để chia sẻ hoặc import lại vào Studio khác.

