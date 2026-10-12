# NSO Game Asset Studio - Development Plan

## Goal
Xây dựng lại Game Asset Studio thành bộ công cụ chuyên dụng cho NSO (Ninja School Online) kết nối trực tiếp với Server Java và Client Unity C#, hỗ trợ cơ chế lưu nháp (Snapshot Changeset), xem trước thời gian thực (Live Preview), chỉnh sửa toàn diện (Map, Nhân vật/Part, Vật phẩm/Thú cưỡi, Sprite/Animation) và xuất dữ liệu đa nền tảng (Server Release, Unity Client Animation & ModPack).

## Tasks
- [x] Task 1: **Backend Core, Binary Map Parser & Database Access**
  - Xây dựng module đọc/ghi file nhị phân `Data/Map/{id}` chuẩn NSO Java (`TileMap.java`: `tmw`, `tmh`, tile index mảng 1 chiều có giải mã key offset).
  - Mở rộng kết nối MariaDB hỗ trợ đọc/ghi có Transaction, tự động sao lưu bản `.bak` trước khi cập nhật.
  - *Verify*: Đọc thử map ID bất kỳ (vd map 1), parse ra đúng kích thước `tmw, tmh`, xuất lại nhị phân so khớp nguyên vẹn byte-by-byte.

- [x] Task 2: **Snapshot Changeset Engine (Draft & Review System)**
  - Xây dựng hệ thống lưu nháp `drafts/changeset.json`: lưu trữ delta thay đổi của Map, Item, Part, Sprite mà không làm biến đổi file gốc.
  - Cung cấp API xem trước Diff (trước vs sau khi sửa), Hủy nháp (Revert), và Áp dụng (Deploy to Game).
  - *Verify*: Tạo nháp chỉnh sửa 1 tile map và 1 item, kiểm tra file gốc chưa đổi; gọi API diff thấy đúng danh sách thay đổi.

- [x] Task 3: **Map Studio (Binary Tile Grid & Visual Entity Spawns)**
  - Canvas vẽ map 2D hỗ trợ bộ tileset 24x24 px từ `Data/Img/Map/{zoom}/tile/{tileId}.png`, background `bg/{bgId}.png`.
  - Công cụ trực quan kéo thả & chỉnh sửa tọa độ: NPC, Waypoint (cổng chuyển map có vùng chạm chữ nhật), Monster Spawn (template, boss flag), và vùng đứng `locationStand`.
  - *Verify*: Mở Map 1 (Trường Hirosaki), hiển thị đúng tile và các NPC/Waypoint/Mob hiện có trên canvas.

- [x] Task 4: **Item & Thú Cưỡi Manager (Items & Mounts Studio)**
  - Quản lý danh sách bảng `item` và `item_option`.
  - Phân hệ chuyên sâu cho Thú cưỡi (Mounts - type 29..33: Sói, Xe máy, Trâu, Hổ, Phượng hoàng...): cấu hình chỉ số nâng cấp `fixMountOption()`, cấp độ, thời hạn.
  - Bộ chọn icon trực quan từ `Data/Img/Small/{icon}.png` và gán Part ngoại trang.
  - *Verify*: Tìm kiếm item Xe máy (ID 485), hiển thị đúng icon, cấp độ 50, cho phép sửa option và lưu vào draft.

- [x] Task 5: **Character & Part Studio (Avatar & Outfit Composer)**
  - Quản lý bảng `nj_part` (Head type 0, Body type 1, Leg type 2, Weapon type 3) và tọa độ cắt `nj_image`.
  - Canvas lắp ghép bộ 4 part + cưỡi thú, cho phép xem trước chuyển động Idle, Walk, Attack.
  - Công cụ căn chỉnh offset `dx, dy` của từng frame part bằng chuột hoặc phím điều hướng.
  - *Verify*: Lắp ghép một set nhân vật (Đầu + Áo + Quần + Vũ khí) và xem animation chạy mượt mà.

- [x] Task 6: **Sprite & Animation Studio (Sprites, Frames, Sequence)**
  - Công cụ cắt lát ảnh (`sprites`: x, y, w, h) từ raw PNG trong `Data/Img/`.
  - Frame Assembler (`frames`): ghép các part con với `dx, dy, flip, onTop`.
  - Sequence Controller (`sequence`): tạo chuỗi chuyển động, điều chỉnh FPS, loop. Áp dụng cho Monster và Effect.
  - *Verify*: Mở quái Thủy Tinh (ID 167), preview chạy đúng animation di chuyển và tấn công từ dữ liệu sequence.

- [x] Task 7: **Multi-Target Exporter & Unity Animation Generator**
  - **Target Server**: Đóng gói `Data/Map/` nhị phân, `Data/Img/` và file `patch_migration.sql`.
  - **Target Unity Client**: Xuất cấu trúc thư mục `Assets/Resources/...`, sinh Animation Metadata JSON + Kèm script C# mẫu `NsoAnimationPlayer.cs`.
  - **Target ModPack (.zip)**: Xuất trọn gói kèm `manifest.json` và hỗ trợ nạp lại (Import).
  - *Verify*: Bấm xuất Unity cho 1 sprite animation, tải về file zip kiểm tra đầy đủ ảnh sprite sheet, file json và script C#.

- [x] Task 8: **UI/UX Workbench Shell & Tích hợp Hoàn chỉnh**
  - Tái cấu trúc giao diện Vue 3 với Dark Theme chuẩn `DESIGN.md`: Thanh điều hướng phân hệ (Map, Character, Item/Mount, Sprite, Export), Floating Status Bar hiển thị số lượng thay đổi chưa áp dụng.
  - Hộp thoại Diff Viewer & One-click Deploy to Game.
  - *Verify*: Chạy `npm run dev` trong `asset-studio`, giao diện chuyển đổi mượt mà giữa các tab, không có lỗi console hay crash.

- [x] Task 9: **Kiểm thử Toàn diện & Xác thực**
  - Kiểm tra end-to-end: Sửa map -> Sửa thú cưỡi -> Ghép avatar -> Cắt sprite -> Preview -> Xuất gói Unity & Server -> Deploy.

## Done When
- [x] Chỉnh sửa và lưu được file nhị phân `Data/Map/` và bảng `map` chuẩn NSO.
- [x] Quản lý đầy đủ Item và Thú Cưỡi (type 29..33) kèm icon và chỉ số option.
- [x] Lắp ghép và preview được chuyển động nhân vật từ các bộ `nj_part` và thú cưỡi.
- [x] Cắt và lắp ráp được animation cho Quái vật và Hiệu ứng (`sprites`, `frames`, `sequence`).
- [x] Có hệ thống lưu nháp (Draft), Live Preview và Deploy an toàn có backup.
- [x] Xuất được Animation tương thích Unity C# Client kèm script C# mẫu.
