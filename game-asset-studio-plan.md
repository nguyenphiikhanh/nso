# Game Asset Studio

## Goal
Create a standalone Node.js + Vue tool for authoring a new 2D game's tile maps and asset metadata, storing project data as JSON with imported PNG files.

## Tasks
- [x] Scaffold an isolated Vue/Vite frontend and Node API under `asset-studio/` → Verify: frontend and API start from documented scripts.
- [x] Define the editor visual system and project data format → Verify: tokens and TypeScript models cover maps and the four asset types plus tiles.
- [x] Build the tile map editor → Verify: create/select a map, paint and erase tiles, and save/reload its JSON.
- [x] Build asset library and inspector → Verify: create/edit/delete items, characters, outfits, mounts, and tiles; upload and preview PNGs.
- [x] Add project save/load, import/export, and setup documentation → Verify: project JSON and media are kept under the selected project directory.
- [x] Verify production build and Node server syntax; report any limitations.

## Done When
- The tool runs independently of the Java game server.
- Map editing and asset metadata changes persist locally.
- Uploaded PNGs preview in the editor and are referenced by project JSON.

## Notes
- MVP uses tile/sprite placement; no pixel-art drawing tools.
- Local single-user project folder, not a shared database.
