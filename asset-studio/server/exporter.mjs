import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { writeMapBinary } from './mapBinary.mjs'
import { getMapById, getItemById, getMonsterById } from './db.mjs'

const execAsync = promisify(exec)

export const UNITY_CSHARP_PLAYER_TEMPLATE = `using System;
using System.Collections.Generic;
using UnityEngine;

namespace NSO.Client
{
    /// <summary>
    /// Script phát Animation chuẩn NSO xuất từ Game Asset Studio cho Unity C#
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    public class NsoAnimationPlayer : MonoBehaviour
    {
        [System.Serializable]
        public class SpriteSlice
        {
            public int id;
            public int x;
            public int y;
            public int w;
            public int h;
        }

        [System.Serializable]
        public class FramePart
        {
            public int id;
            public int dx;
            public int dy;
            public int flip;
            public int onTop;
        }

        [System.Serializable]
        public class Frame
        {
            public List<FramePart> parts = new List<FramePart>();
        }

        [System.Serializable]
        public class AnimationClipData
        {
            public string name;
            public float fps = 10f;
            public int[] sequence;
        }

        [System.Serializable]
        public class AnimationPackage
        {
            public string entityName;
            public List<SpriteSlice> sprites = new List<SpriteSlice>();
            public List<Frame> frames = new List<Frame>();
            public List<AnimationClipData> clips = new List<AnimationClipData>();
        }

        [Header("Animation Data")]
        public TextAsset animationJson;
        public Texture2D spriteTexture;

        [Header("Playback")]
        public string activeClip = "idle";
        public bool isPlaying = true;
        public float playbackSpeed = 1.0f;

        private SpriteRenderer sr;
        private AnimationPackage data;
        private int currentSequenceStep = 0;
        private float frameTimer = 0f;
        private Dictionary<int, Sprite> cachedSprites = new Dictionary<int, Sprite>();

        void Awake()
        {
            sr = GetComponent<SpriteRenderer>();
            if (animationJson != null)
            {
                LoadData(animationJson.text);
            }
        }

        public void LoadData(string json)
        {
            data = JsonUtility.FromJson<AnimationPackage>(json);
            BuildSpriteCache();
        }

        void BuildSpriteCache()
        {
            if (spriteTexture == null || data == null) return;
            cachedSprites.Clear();

            int texH = spriteTexture.height;
            foreach (var s in data.sprites)
            {
                // Unity Texture coordinate (0,0 tại góc dưới bên trái)
                Rect r = new Rect(s.x, texH - s.y - s.h, s.w, s.h);
                Sprite sp = Sprite.Create(spriteTexture, r, new Vector2(0.5f, 0.5f), 100f);
                cachedSprites[s.id] = sp;
            }
        }

        void Update()
        {
            if (!isPlaying || data == null || data.clips.Count == 0) return;

            AnimationClipData clip = data.clips.Find(c => c.name.Equals(activeClip, StringComparison.OrdinalIgnoreCase));
            if (clip == null || clip.sequence == null || clip.sequence.Length == 0) return;

            frameTimer += Time.deltaTime * playbackSpeed;
            float interval = 1f / Mathf.Max(1f, clip.fps);

            if (frameTimer >= interval)
            {
                frameTimer -= interval;
                currentSequenceStep = (currentSequenceStep + 1) % clip.sequence.Length;
                RenderFrame(clip.sequence[currentSequenceStep]);
            }
        }

        void RenderFrame(int frameIndex)
        {
            if (data == null || frameIndex < 0 || frameIndex >= data.frames.Count) return;
            Frame f = data.frames[frameIndex];
            if (f.parts.Count > 0)
            {
                // Render part chính đầu tiên
                int spriteId = f.parts[0].id;
                if (cachedSprites.TryGetValue(spriteId, out Sprite sp))
                {
                    sr.sprite = sp;
                    sr.flipX = f.parts[0].flip == 1;
                }
            }
        }
    }
}
`

/**
 * Xuất gói tài nguyên theo Target Profile
 */
export async function createExportPackage({
  target,
  changeset,
  dataMapDir,
  exportDir,
  selectedIds = {},
}) {
  const exportId = randomUUID().slice(0, 8)
  const stagingDir = join(exportDir, `pkg_${target}_${exportId}`)
  const zipPath = join(exportDir, `nso_${target}_${exportId}.zip`)

  await mkdir(stagingDir, { recursive: true })

  try {
    if (target === 'server') {
      // 1. Target NSO Server: Data/Map + patch.sql
      const mapDir = join(stagingDir, 'Data', 'Map')
      await mkdir(mapDir, { recursive: true })

      let sqlLines = ['-- NSO Server Migration Patch', '-- Generated by Game Asset Studio\n']

      // Compile maps
      for (const [idStr, mapData] of Object.entries(changeset.maps || {})) {
        const id = Number(idStr)
        if (selectedIds.maps && !selectedIds.maps.includes(id)) continue

        if (Array.isArray(mapData.tiles) && mapData.tmw && mapData.tmh) {
          await writeMapBinary(mapDir, stagingDir, id, mapData.tmw, mapData.tmh, mapData.tiles)
        }

        sqlLines.push(
          `UPDATE \`map\` SET \`name\` = ${JSON.stringify(mapData.name)}, ` +
            `\`tileId\` = ${mapData.tileId}, \`bgId\` = ${mapData.bgId}, ` +
            `\`npc\` = ${JSON.stringify(JSON.stringify(mapData.npc || []))}, ` +
            `\`waypoint\` = ${JSON.stringify(JSON.stringify(mapData.waypoint || []))}, ` +
            `\`monster\` = ${JSON.stringify(JSON.stringify(mapData.monster || []))} ` +
            `WHERE \`id\` = ${id};`
        )
      }

      // Items & Mounts
      for (const [idStr, item] of Object.entries(changeset.items || {})) {
        const id = Number(idStr)
        if (selectedIds.items && !selectedIds.items.includes(id)) continue

        sqlLines.push(
          `UPDATE \`item\` SET \`name\` = ${JSON.stringify(item.name)}, ` +
            `\`type\` = ${item.type}, \`level\` = ${item.level}, \`icon\` = ${item.icon}, ` +
            `\`part\` = ${item.part}, \`fashion\` = ${item.fashion} WHERE \`id\` = ${id};`
        )
      }

      await writeFile(join(stagingDir, 'patch_migration.sql'), sqlLines.join('\n'), 'utf8')
    } else if (target === 'unity') {
      // 2. Target Unity Client: Resources + Animation JSON + C# Player
      const resourcesDir = join(stagingDir, 'Assets', 'Resources', 'Data', 'NsoExport')
      await mkdir(resourcesDir, { recursive: true })

      // Viết file C# Player Script
      const scriptsDir = join(stagingDir, 'Assets', 'Scripts')
      await mkdir(scriptsDir, { recursive: true })
      await writeFile(
        join(scriptsDir, 'NsoAnimationPlayer.cs'),
        UNITY_CSHARP_PLAYER_TEMPLATE,
        'utf8'
      )

      // Viết JSON metadata cho quái vật / sprite
      for (const [idStr, mob] of Object.entries(changeset.monsters || {})) {
        const id = Number(idStr)
        if (selectedIds.monsters && !selectedIds.monsters.includes(id)) continue

        const animPkg = {
          entityName: mob.name || `Monster_${id}`,
          sprites: mob.sprites || [],
          frames: mob.frames || [],
          clips: [
            { name: 'idle', fps: 8, sequence: mob.sequence?.slice(0, 4) || [0] },
            { name: 'move', fps: 10, sequence: mob.move || mob.sequence || [0] },
            { name: 'attack', fps: 12, sequence: mob.attack || [0] },
          ],
        }
        await writeFile(
          join(resourcesDir, `mob_${id}_animation.json`),
          JSON.stringify(animPkg, null, 2),
          'utf8'
        )
      }

      // Viết file Map definitions cho Unity
      const mapsSummary = Object.values(changeset.maps || {}).map((m) => ({
        id: m.id,
        name: m.name,
        tmw: m.tmw,
        tmh: m.tmh,
        tileId: m.tileId,
        bgId: m.bgId,
        npc: m.npc,
        waypoint: m.waypoint,
      }))
      await writeFile(
        join(resourcesDir, 'maps_definition.json'),
        JSON.stringify(mapsSummary, null, 2),
        'utf8'
      )
    } else {
      // 3. Target ModPack (Universal)
      const manifest = {
        name: 'NSO Studio ModPack',
        exportId,
        createdAt: new Date().toISOString(),
        counts: {
          maps: Object.keys(changeset.maps || {}).length,
          items: Object.keys(changeset.items || {}).length,
          monsters: Object.keys(changeset.monsters || {}).length,
        },
      }
      await writeFile(join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
      await writeFile(join(stagingDir, 'draft.json'), JSON.stringify(changeset, null, 2), 'utf8')
    }

    // Zip staging directory
    await execAsync(`zip -r "${zipPath}" .`, { cwd: stagingDir })

    return {
      success: true,
      exportId,
      filename: `nso_${target}_${exportId}.zip`,
      downloadUrl: `/api/exports/${encodeURIComponent(`nso_${target}_${exportId}.zip`)}`,
    }
  } finally {
    // Dọn dẹp thư mục tạm staging
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Xuất gói dữ liệu nhân vật chuyên biệt cho Unity C# (Option D - Hybrid)
 */
export async function createCharacterExportPackage({
  loadout,
  actionSequences,
  actionName = 'idle',
  actionSequence = null,
  waistOverlap = 8,
  neckOverlap = 20,
  fps = 8,
  parts = [],
  exportDir,
  resolveSourceMedia,
}) {
  const exportId = randomUUID().slice(0, 8)
  const actPrefix = actionName ? `char_${actionName}` : 'char_unity'
  const stagingDir = join(exportDir, `pkg_${actPrefix}_${exportId}`)
  const zipFilename = `nso_${actPrefix}_${exportId}.zip`
  const zipPath = join(exportDir, zipFilename)

  await mkdir(stagingDir, { recursive: true })

  try {
    const dataDir = join(stagingDir, 'Assets', 'Resources', 'Data', 'NsoExport')
    const spritesDir = join(stagingDir, 'Assets', 'Resources', 'Sprites', 'Small')
    const docsDir = join(stagingDir, 'Assets', 'Scripts')
    await mkdir(dataDir, { recursive: true })
    await mkdir(spritesDir, { recursive: true })
    await mkdir(docsDir, { recursive: true })

    // 1. Ghi file Action Sequence (1 Animation)
    const effectiveActionSequence = actionSequence || (actionSequences ? actionSequences[actionName] : null)
    const actionsData = {
      meta: {
        generator: 'Game Asset Studio - NSO Single Action Unity Exporter',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        action: actionName,
        fps,
        waistOverlap,
        neckOverlap,
      },
      currentLoadout: loadout,
      actionName,
      actionSequence: effectiveActionSequence,
    }
    await writeFile(
      join(dataDir, `character_${actionName}.json`),
      JSON.stringify(actionsData, null, 2),
      'utf8'
    )

    // 2. Ghi file Parts definitions
    const partsData = {
      loadout,
      parts: parts.map((p) => ({
        id: p.id,
        type: p.type,
        typeLabel: p.type === 0 ? 'head' : p.type === 1 ? 'body' : p.type === 2 ? 'leg' : 'weapon',
        frames: p.part || [],
      })),
    }
    await writeFile(
      join(dataDir, 'character_parts.json'),
      JSON.stringify(partsData, null, 2),
      'utf8'
    )

    // 3. Trích xuất và copy các file ảnh PNG cần thiết
    const collectedImageIds = new Set()
    for (const p of parts) {
      if (Array.isArray(p.part)) {
        for (const f of p.part) {
          if (f.id && f.id > 0) {
            collectedImageIds.add(f.id)
          }
        }
      }
    }

    let copiedCount = 0
    if (typeof resolveSourceMedia === 'function') {
      for (const imgId of collectedImageIds) {
        const foundPath = resolveSourceMedia(`Small/${imgId}.png`)
        if (foundPath) {
          const dest = join(spritesDir, `${imgId}.png`)
          await copyFile(foundPath, dest).catch(() => {})
          copiedCount++
        }
      }
    }

    // 4. File hướng dẫn Unity
    const readmeContent = `=== HƯỚNG DẪN IMPORT VÀO UNITY C# ===
Gói xuất từ Game Asset Studio cho Nhân Vật (Option D - Hybrid)

1. CẤU TRÚC THƯ MỤC:
   Assets/Resources/Data/NsoExport/
     ├── character_actions.json   -> Timeline hành động (Idle, Walk, Attack, Jump) kèm lungeX, jumpY, rot vũ khí
     └── character_parts.json     -> Thông số từng Part và tọa độ (dx, dy) của từng Frame
   Assets/Resources/Sprites/Small/
     └── *.png                    -> Toàn bộ sprite PNG của các Part đang trang bị (${copiedCount} ảnh)

2. TẠO GAMEOBJECT NHÂN VẬT TRONG UNITY:
   Tạo 1 GameObject "NsoCharacter" với các SpriteRenderer con theo thứ tự Sorting Order:
     - Leg (Chân)       : Order in Layer = 10
     - Body (Thân)      : Order in Layer = 11
     - Head (Đầu)       : Order in Layer = 12
     - Weapon (Vũ khí)  : Order in Layer = 13 (hoặc 9 nếu nằm sau thân)

3. LƯU Ý CHO UNITY C#:
   - Texture Type của ảnh PNG: Chọn "Sprite (2D and UI)".
   - Sprite Mode: "Single", Filter Mode: "Point (no filter)" để giữ nguyên pixel art NSO.
   - Khi chạy Action Attack hoặc Jump: đọc giá trị "lungeX" và "jumpY" trong character_actions.json
     để tịnh tiến vị trí root GameObject hoặc Weapon transform.

4. NẾU DÙNG TEXTURE ATLAS (1 ẢNH PNG TO GỘP TẤT CẢ MẢNH NHỎ):
   - Vào Tab "2. Atlas Mảnh Chi Tiết" trên Game Asset Studio để tải 1 file "character_parts_atlas.png" và "character_parts_atlas.json".
   - Trong Unity Inspector: chọn Sprite Mode = "Multiple", Filter Mode = "Point (no filter)".
   - Dùng file JSON metadata hoặc Script C# mẫu có sẵn trên Studio để tự động load và cắt sprite theo đúng tọa độ Rect.
`
    await writeFile(join(docsDir, 'README_UNITY_SETUP.txt'), readmeContent, 'utf8')

    // 5. Nén zip
    await execAsync(`zip -r "${zipPath}" .`, { cwd: stagingDir })

    return {
      success: true,
      exportId,
      filename: zipFilename,
      downloadUrl: `/api/exports/${encodeURIComponent(zipFilename)}`,
      copiedSprites: copiedCount,
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
}
