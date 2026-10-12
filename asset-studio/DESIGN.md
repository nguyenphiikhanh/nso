---
version: alpha
name: Game Asset Studio
description: A dark, canvas-first workbench for designing 2D game maps and managing sprite assets.
colors:
  canvas: "#101416"
  surface: "#171D1F"
  surface-raised: "#20282A"
  surface-hover: "#293335"
  border: "#344143"
  text: "#E9EFEB"
  muted: "#98A6A1"
  accent: "#B9F36B"
  accent-ink: "#18210F"
  accent-soft: "#293A21"
  warm: "#F1A773"
  danger: "#EF7772"
  grid: "#334044"
typography:
  title:
    fontFamily: "Arial, sans-serif"
    fontSize: 20px
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "Arial, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Arial, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.3
  mono:
    fontFamily: "Cascadia Code, Consolas, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: 3px
  sm: 5px
  md: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  primary-action:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: 8px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 12px
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.xs}"
    height: 32px
---

# Game Asset Studio

## Overview
The app is a desktop-first creative tool for game developers. A single dark work surface keeps attention on the map or sprite preview. The map canvas owns the visual hierarchy; side panels stay compact and support fast, repeated editing.

The visual direction borrows the precision of professional design software and the clear selection feedback of a game editor. The frame stays quiet while the selected tool, active tile, dirty state, and validation feedback use the accent color.

## Colors
- Canvas and panels use layered charcoal-green surfaces to separate work areas without heavy shadows.
- Acid-lime marks selected tools, the active tile, and save confirmation.
- Warm amber is reserved for warnings and unsaved-change hints.

## Typography
- Use a compact sans-serif for labels and instructions.
- Use monospaced text for coordinates, IDs, dimensions, and asset paths.
- Keep headings modest so the canvas stays dominant.

## Layout & Module Architecture
- **Top Bar**: Điều hướng các phân hệ chuyên sâu (🗺️ Map, 🥋 Character, 🎒 Items & Mounts, 🎬 Sprite/Animation), thanh trạng thái kết nối DB, và nút **Export** đa nền tảng.
- **Draft Floating Bar**: Nằm ở góc dưới màn hình, hiển thị số lượng thay đổi chưa áp dụng (e.g., "3 thay đổi chưa lưu vào game"), nút **"Xem Diff"**, và nút **"Deploy to Game"** màu acid-lime.
- **Left Rail & Library**: Lựa chọn danh sách thực thể (Danh sách Map NSO, Danh sách Quái vật, Danh sách Part trang phục, Danh sách Item/Thú cưỡi).
- **Central Canvas / Previewer**: Không gian làm việc chính chiếm diện tích lớn nhất (vẽ tile map, kéo thả waypoint/mob/npc, preview avatar, timeline animation).
- **Right Inspector**: Bảng thuộc tính chi tiết cho đối tượng đang chọn (thuộc tính Map, options của Item, chỉ số thú cưỡi, thông số frame).

## Unity Client & Pixel Perfection
- Mọi canvas hiển thị ảnh (Map Tiles, Sprites, Parts) bắt buộc dùng `image-rendering: pixelated` (Nearest-Neighbor) để đảm bảo không bị nhòe pixel.
- Hỗ trợ xem trước ở các mốc zoom chuẩn NSO Unity: `1x`, `2x`, `3x`, `4x`.

## Elevation & Depth
Use surface layers, fine borders, and restrained shadows. Avoid floating glass panels and decorative gradients.

## Shapes
Use small radii consistently. Tool controls should feel precise and easy to scan, not pill-shaped.

## Components
- Buttons expose hover, pressed, disabled, and keyboard-focus states.
- Inputs always include a visible label.
- Empty asset slots show a checkerboard preview and a direct import action.
- The canvas uses a pixel grid and nearest-neighbor sprite rendering.

## Do's and Don'ts
- Do keep keyboard shortcuts visible next to map tools.
- Do show map dimensions, zoom, selected tile, and save status near the canvas.
- Don't use cards for every row or field.
- Don't use purple, glass effects, or decorative dashboard charts.

