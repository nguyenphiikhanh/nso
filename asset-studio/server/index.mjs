import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { readMapBinary } from './mapBinary.mjs'
import {
  getDbPool,
  getAllMaps,
  getMapById,
  getItemsList,
  getItemById,
  getAllItemOptionTemplates,
  getAllParts,
  getAllImages,
  getMonstersList,
  getMonsterById,
} from './db.mjs'
import { ChangesetEngine } from './changeset.mjs'
import { createExportPackage, createCharacterExportPackage } from './exporter.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const repoRoot = resolve(appRoot, '..')
const sourceImgDir = resolve(process.env.GAME_SOURCE_IMG_DIR || join(repoRoot, 'Data', 'Img'))
const dataMapDir = resolve(process.env.GAME_DATA_MAP_DIR || join(repoRoot, 'Data', 'Map'))
const backupDir = resolve(appRoot, 'backups')
const draftFile = resolve(appRoot, 'drafts', 'changeset.json')
const exportDir = resolve(appRoot, 'exports')
const mediaDir = join(appRoot, 'projects', 'default', 'assets')
const port = Number(process.env.PORT || 3001)

await mkdir(mediaDir, { recursive: true })
await mkdir(backupDir, { recursive: true })
await mkdir(exportDir, { recursive: true })

const changesetEngine = new ChangesetEngine({
  draftFile,
  dataMapDir,
  backupDir,
})

let sourceIndexPromise

async function listPngs(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return listPngs(path)
      return entry.isFile() && extname(entry.name).toLowerCase() === '.png' ? [path] : []
    })
  )
  return nested.flat()
}

function getSourceIndex() {
  if (!sourceIndexPromise) {
    sourceIndexPromise = listPngs(sourceImgDir).then((paths) =>
      paths
        .map((path) => {
          const relativePath = relative(sourceImgDir, path).split(sep).join('/')
          const parts = relativePath.split('/')
          const group = parts[0] || 'Other'
          const variant =
            parts.length > 2
              ? parts.slice(1, -1).join('/')
              : parts[1]
                ? parts[1].replace(/\.png$/i, '')
                : 'base'
          const name = parts.at(-1).replace(/\.png$/i, '')
          const url = `/source-media/${relativePath.split('/').map(encodeURIComponent).join('/')}`
          return { id: relativePath, name, group, variant, relativePath, url }
        })
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) ||
            a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true })
        )
    )
  }
  return sourceIndexPromise
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, done) => done(null, mediaDir),
    filename: (_request, file, done) =>
      done(null, `${randomUUID()}${extname(file.originalname).toLowerCase() || '.png'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, done) => {
    if (file.mimetype !== 'image/png' || extname(file.originalname).toLowerCase() !== '.png') {
      done(new Error('Chỉ hỗ trợ ảnh PNG.'))
      return
    }
    done(null, true)
  },
})

const TRANSPARENT_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

function resolveSourceMedia(rawPath) {
  const subPath = rawPath.replace(/^\/+/, '').split('?')[0]
  const candidates = [join(sourceImgDir, subPath)]

  if (subPath.startsWith('Small/')) {
    const raw = subPath.replace(/^Small\//, '').replace(/\.png$/i, '').replace(/^Small/i, '')
    const num = Number.parseInt(raw, 10)
    const rawCandidates = [
      `Small${raw}.png`,
      `Small1${raw}.png`,
      `${raw}.png`,
      `1${raw}.png`,
    ]
    if (!Number.isNaN(num)) {
      rawCandidates.push(`Small${10000 + num}.png`)
      if (num > 10000) {
        rawCandidates.push(`Small${num % 10000}.png`, `Small${String(num).slice(1)}.png`)
      }
    }

    const scales = ['4', '2', '1', '3', '']
    for (const s of scales) {
      for (const rc of rawCandidates) {
        if (s) {
          candidates.push(join(sourceImgDir, 'Small', s, rc))
        } else {
          candidates.push(join(sourceImgDir, 'Small', rc))
        }
      }
    }
  } else if (subPath.startsWith('Mob/')) {
    const raw = subPath.replace(/^Mob\//, '').replace(/\.png$/i, '').replace(/_\d+$/, '')
    candidates.push(
      join(sourceImgDir, 'Mob', '4', `${raw}_0.png`),
      join(sourceImgDir, 'Mob', '2', `${raw}_0.png`),
      join(sourceImgDir, 'Mob', '1', `${raw}_0.png`),
      join(sourceImgDir, 'Mob', '4', `${raw}.png`),
      join(sourceImgDir, 'Mob', '2', `${raw}.png`),
      join(sourceImgDir, 'Mob', `${raw}.png`)
    )
  } else if (subPath.includes('/bg/')) {
    const parts = subPath.split('/bg/')
    const baseDir = parts[0]
    const rawId = parts[1].replace(/\.png$/i, '').replace(/^bg0?/i, '')
    const padded = rawId.padStart(2, '0')
    candidates.push(
      join(sourceImgDir, baseDir, 'bg', `bg${padded}.png`),
      join(sourceImgDir, baseDir, 'bg', `bg0${rawId}.png`),
      join(sourceImgDir, baseDir, 'bg', `bg${rawId}.png`),
      join(sourceImgDir, 'Map', '4', 'bg', `bg${padded}.png`),
      join(sourceImgDir, 'Map', '4', 'bg', `bg0${rawId}.png`),
      join(sourceImgDir, 'Map', '4', 'bg', `bg${rawId}.png`)
    )
  }

  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

const app = express()
app.use(express.json({ limit: '15mb' }))
app.use('/media', express.static(mediaDir, { immutable: true, maxAge: '1y' }))
app.use('/api/exports', express.static(exportDir))

// Smart Image Resolver cho NSO Assets
app.use('/source-media', (request, response) => {
  const reqSubPath = decodeURIComponent(request.path.replace(/^\/+/, ''))
  const resolved = resolveSourceMedia(reqSubPath)
  if (resolved) {
    response.setHeader('Cache-Control', 'public, max-age=3600')
    response.sendFile(resolved)
  } else {
    // Trả về ảnh 1x1 trong suốt, không bao giờ ném lỗi 500
    response.setHeader('Content-Type', 'image/png')
    response.setHeader('Cache-Control', 'public, max-age=3600')
    response.status(200).send(TRANSPARENT_1X1_PNG)
  }
})



app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))

app.get('/api/database-status', async (_request, response) => {
  try {
    const pool = await getDbPool()
    const [rows] = await pool.query('SELECT 1 AS connected')
    response.json({ connected: rows[0]?.connected === 1 })
  } catch (error) {
    response.json({
      connected: false,
      message: 'Chưa kết nối được MariaDB. Kiểm tra container mariadb hoặc mật khẩu.',
    })
  }
})

// ==================== MAP API ====================

app.get('/api/maps', async (_request, response, next) => {
  try {
    const dbMaps = await getAllMaps()
    const draft = await changesetEngine.getChangeset()
    const draftMapIds = new Set(Object.keys(draft.maps || {}))

    const mapsWithDraftFlag = dbMaps.map((m) => {
      const isDraftModified = draftMapIds.has(String(m.id))
      const draftMap = draft.maps?.[String(m.id)]
      return {
        ...m,
        isDraft: isDraftModified,
        name: isDraftModified ? draftMap.name : m.name,
        tileId: isDraftModified ? draftMap.tileId : m.tileId,
        bgId: isDraftModified ? draftMap.bgId : m.bgId,
      }
    })

    response.json(mapsWithDraftFlag)
  } catch (error) {
    next(error)
  }
})

app.get('/api/maps/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const dbMap = await getMapById(id)
    if (!dbMap) {
      response.status(404).json({ error: 'Không tìm thấy Map trong database.' })
      return
    }

    // Đọc binary map tiles
    let binaryData = null
    try {
      binaryData = await readMapBinary(dataMapDir, id)
    } catch (e) {
      console.warn(`Chưa có file binary Data/Map/${id}:`, e.message)
    }

    // Merge với draft nếu có
    const draft = await changesetEngine.getChangeset()
    const draftMap = draft.maps?.[String(id)]

    const finalMap = {
      ...dbMap,
      tmw: draftMap?.tmw || binaryData?.tmw || 30,
      tmh: draftMap?.tmh || binaryData?.tmh || 30,
      tiles: draftMap?.tiles || binaryData?.tiles || [],
      isDraft: Boolean(draftMap),
    }

    if (draftMap) {
      Object.assign(finalMap, draftMap)
    }

    response.json(finalMap)
  } catch (error) {
    next(error)
  }
})

app.put('/api/maps/:id/draft', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const updated = await changesetEngine.updateEntity('maps', id, request.body)
    response.json({ status: 'draft_saved', map: updated })
  } catch (error) {
    next(error)
  }
})

// ==================== ITEM & MOUNT API ====================

app.get('/api/items', async (request, response, next) => {
  try {
    const isMount = request.query.isMount === 'true'
    const type = request.query.type
    const query = request.query.q ? String(request.query.q).trim() : ''
    const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0)
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit || '50'), 10) || 50))

    const data = await getItemsList({ type, isMount, query, offset, limit })
    const draft = await changesetEngine.getChangeset()
    const draftItemIds = new Set(Object.keys(draft.items || {}))

    const mergedItems = data.items.map((item) => {
      const isDraftModified = draftItemIds.has(String(item.id))
      return isDraftModified
        ? { ...item, ...draft.items[String(item.id)], isDraft: true }
        : { ...item, isDraft: false }
    })

    response.json({
      total: data.total,
      offset,
      limit,
      items: mergedItems,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/items/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const dbItem = await getItemById(id)
    if (!dbItem) {
      response.status(404).json({ error: 'Không tìm thấy Item.' })
      return
    }

    const draft = await changesetEngine.getChangeset()
    const draftItem = draft.items?.[String(id)]

    response.json(draftItem ? { ...dbItem, ...draftItem, isDraft: true } : { ...dbItem, isDraft: false })
  } catch (error) {
    next(error)
  }
})

app.put('/api/items/:id/draft', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const updated = await changesetEngine.updateEntity('items', id, request.body)
    response.json({ status: 'draft_saved', item: updated })
  } catch (error) {
    next(error)
  }
})

app.get('/api/item-options', async (_request, response, next) => {
  try {
    const options = await getAllItemOptionTemplates()
    response.json(options)
  } catch (error) {
    next(error)
  }
})

// ==================== PART & AVATAR API ====================

app.get('/api/parts', async (request, response, next) => {
  try {
    const type = request.query.type !== undefined ? Number(request.query.type) : null
    const parts = await getAllParts(type)
    const draft = await changesetEngine.getChangeset()
    const draftPartIds = new Set(Object.keys(draft.parts || {}))

    const merged = parts.map((p) => {
      const isDraftModified = draftPartIds.has(String(p.id))
      return isDraftModified
        ? { ...p, ...draft.parts[String(p.id)], isDraft: true }
        : { ...p, isDraft: false }
    })

    response.json(merged)
  } catch (error) {
    next(error)
  }
})

app.get('/api/images', async (_request, response, next) => {
  try {
    const images = await getAllImages()
    response.json(images)
  } catch (error) {
    next(error)
  }
})

app.put('/api/parts/:id/draft', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const updated = await changesetEngine.updateEntity('parts', id, request.body)
    response.json({ status: 'draft_saved', part: updated })
  } catch (error) {
    next(error)
  }
})

// ==================== MONSTER & ANIMATION API ====================

app.get('/api/monsters', async (request, response, next) => {
  try {
    const query = request.query.q ? String(request.query.q).trim() : ''
    const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0)
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit || '50'), 10) || 50))

    const data = await getMonstersList({ query, offset, limit })
    const draft = await changesetEngine.getChangeset()
    const draftMobIds = new Set(Object.keys(draft.monsters || {}))

    const merged = data.monsters.map((m) => {
      const isDraft = draftMobIds.has(String(m.id))
      return isDraft ? { ...m, ...draft.monsters[String(m.id)], isDraft: true } : { ...m, isDraft: false }
    })

    response.json({ total: data.total, monsters: merged, offset, limit })
  } catch (error) {
    next(error)
  }
})

app.get('/api/monsters/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const dbMob = await getMonsterById(id)
    if (!dbMob) {
      response.status(404).json({ error: 'Không tìm thấy Quái vật.' })
      return
    }

    const draft = await changesetEngine.getChangeset()
    const draftMob = draft.monsters?.[String(id)]

    response.json(draftMob ? { ...dbMob, ...draftMob, isDraft: true } : { ...dbMob, isDraft: false })
  } catch (error) {
    next(error)
  }
})

app.put('/api/monsters/:id/draft', async (request, response, next) => {
  try {
    const id = Number(request.params.id)
    const updated = await changesetEngine.updateEntity('monsters', id, request.body)
    response.json({ status: 'draft_saved', monster: updated })
  } catch (error) {
    next(error)
  }
})

// ==================== SOURCE ASSETS (IMAGES & ICONS) ====================

app.get('/api/source-assets', async (request, response, next) => {
  try {
    const allAssets = await getSourceIndex()
    const groups = [...new Set(allAssets.map((asset) => asset.group))]
    const group = typeof request.query.group === 'string' ? request.query.group : ''
    const variant = typeof request.query.variant === 'string' ? request.query.variant : ''
    const query = typeof request.query.q === 'string' ? request.query.q.trim().toLocaleLowerCase() : ''
    const filtered = allAssets.filter(
      (asset) =>
        (!group || asset.group === group) &&
        (!variant || asset.variant === variant) &&
        (!query ||
          asset.name.toLocaleLowerCase().includes(query) ||
          asset.relativePath.toLocaleLowerCase().includes(query))
    )
    const limit = Math.min(120, Math.max(1, Number.parseInt(String(request.query.limit || '60'), 10) || 60))
    const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0)
    const groupCounts = Object.fromEntries(
      groups.map((name) => [name, allAssets.filter((asset) => asset.group === name).length])
    )
    const variants = [
      ...new Set(
        allAssets.filter((asset) => !group || asset.group === group).map((asset) => asset.variant)
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    response.json({
      rootAvailable: allAssets.length > 0,
      total: filtered.length,
      offset,
      limit,
      groups: groups.map((name) => ({ name, count: groupCounts[name] })),
      variants,
      assets: filtered.slice(offset, offset + limit),
    })
  } catch (error) {
    next(error)
  }
})

// ==================== DRAFT CHANGESET & DEPLOY ====================

app.get('/api/draft', async (_request, response, next) => {
  try {
    const summary = await changesetEngine.getSummary()
    response.json(summary)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/draft/:category/:id', async (request, response, next) => {
  try {
    const { category, id } = request.params
    const result = await changesetEngine.revertEntity(category, id)
    response.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/draft/clear', async (_request, response, next) => {
  try {
    await changesetEngine.clearChangeset()
    response.json({ status: 'cleared' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/draft/deploy', async (_request, response, next) => {
  try {
    const deployResults = await changesetEngine.deployAll()
    response.json({ status: 'deployed', ...deployResults })
  } catch (error) {
    next(error)
  }
})

// ==================== MULTI-TARGET EXPORT ====================

app.post('/api/export-package', async (request, response, next) => {
  try {
    const { target = 'server', selectedIds = {} } = request.body
    const changeset = await changesetEngine.getChangeset()

    const exportResult = await createExportPackage({
      target,
      changeset,
      dataMapDir,
      exportDir,
      selectedIds,
    })

    response.json(exportResult)
  } catch (error) {
    next(error)
  }
})

app.post('/api/export-character-unity', async (request, response, next) => {
  try {
    const {
      loadout,
      actionSequences,
      actionName,
      actionSequence,
      waistOverlap = 8,
      neckOverlap = 20,
      fps = 8,
      parts = [],
    } = request.body

    const result = await createCharacterExportPackage({
      loadout,
      actionSequences,
      actionName,
      actionSequence,
      waistOverlap,
      neckOverlap,
      fps,
      parts,
      exportDir,
      resolveSourceMedia,
    })

    response.json(result)
  } catch (error) {
    next(error)
  }
})

const distDir = join(appRoot, 'dist')
app.use(express.static(distDir))
app.use((request, response, next) => {
  if (request.method === 'GET' && request.accepts('html')) {
    response.sendFile(join(distDir, 'index.html'), (error) => error && next())
    return
  }
  next()
})

app.use((error, _request, response, _next) => {
  console.error('API Error:', error)
  response.status(500).json({ error: error.message || 'Lỗi xử lý API.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`NSO Asset Studio API chạy tại: http://127.0.0.1:${port}`)
  console.log(`Data Map: ${dataMapDir}`)
  console.log(`Data Img: ${sourceImgDir}`)
})
