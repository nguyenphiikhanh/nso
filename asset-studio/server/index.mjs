import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import mysql from 'mysql2/promise'
import { parse as parseYaml } from 'yaml'
import { createDefaultProject } from './defaultProject.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const projectDir = resolve(process.env.GAME_PROJECT_DIR || join(appRoot, 'projects', 'default'))
const sourceImgDir = resolve(process.env.GAME_SOURCE_IMG_DIR || join(appRoot, '..', 'Data', 'Img'))
const mediaDir = join(projectDir, 'assets')
const projectFile = join(projectDir, 'project.json')
const composeFile = resolve(appRoot, '..', 'docker-compose.yml')
const port = Number(process.env.PORT || 3001)
let sourceIndexPromise
let databasePool

await mkdir(mediaDir, { recursive: true })

async function readProject() {
  try {
    return JSON.parse(await readFile(projectFile, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const project = createDefaultProject()
    await writeProject(project)
    return project
  }
}

async function writeProject(project) {
  const tempFile = `${projectFile}.${randomUUID()}.tmp`
  await writeFile(tempFile, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
  await rename(tempFile, projectFile)
}

async function listPngs(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listPngs(path)
    return entry.isFile() && extname(entry.name).toLowerCase() === '.png' ? [path] : []
  }))
  return nested.flat()
}

function getSourceIndex() {
  if (!sourceIndexPromise) {
    sourceIndexPromise = listPngs(sourceImgDir).then((paths) => paths.map((path) => {
      const relativePath = relative(sourceImgDir, path).split(sep).join('/')
      const parts = relativePath.split('/')
      const group = parts[0] || 'Other'
      const variant = parts.length > 2 ? parts.slice(1, -1).join('/') : parts[1] ? parts[1].replace(/\.png$/i, '') : 'base'
      const name = parts.at(-1).replace(/\.png$/i, '')
      const url = `/source-media/${relativePath.split('/').map(encodeURIComponent).join('/')}`
      return { id: relativePath, name, group, variant, relativePath, url }
    }).sort((a, b) => a.group.localeCompare(b.group) || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true })))
  }
  return sourceIndexPromise
}

async function getDatabasePool() {
  if (databasePool) return databasePool
  const compose = parseYaml(await readFile(composeFile, 'utf8'))
  const database = compose?.services?.mariadb
  if (!database) throw new Error('Không tìm thấy service mariadb trong docker-compose.yml.')
  const env = database.environment || {}
  const mappedPort = (database.ports || []).map((entry) => String(entry).split(':')).find((parts) => parts.at(-1) === '3306')
  databasePool = mysql.createPool({
    host: process.env.ASSET_STUDIO_DB_HOST || (process.env.ASSET_STUDIO_IN_DOCKER === '1' ? 'mariadb' : '127.0.0.1'),
    port: Number(process.env.ASSET_STUDIO_DB_PORT || mappedPort?.at(-2) || 3306),
    database: process.env.ASSET_STUDIO_DB_NAME || env.MARIADB_DATABASE,
    user: process.env.ASSET_STUDIO_DB_USER || env.MARIADB_USER,
    password: process.env.ASSET_STUDIO_DB_PASSWORD || env.MARIADB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: 2500,
  })
  return databasePool
}

function isProject(value) {
  return value && value.version === 1 && typeof value.name === 'string'
    && value.name.length <= 80 && Array.isArray(value.assets) && Array.isArray(value.maps)
    && value.maps.every((map) => Number.isInteger(map.width) && Number.isInteger(map.height)
      && map.width >= 4 && map.height >= 4 && map.width <= 128 && map.height <= 128
      && Number.isInteger(map.tileSize) && map.tileSize >= 8 && map.tileSize <= 128
      && Array.isArray(map.tiles) && map.tiles.length === map.width * map.height
      && map.tiles.every((tileId) => tileId === null || typeof tileId === 'string'))
    && value.assets.every((asset) => asset && typeof asset.id === 'string'
      && typeof asset.name === 'string' && asset.name.length <= 64
      && ['tile', 'item', 'character', 'outfit', 'mount'].includes(asset.kind)
      && (asset.imageUrl === null || (typeof asset.imageUrl === 'string' && asset.imageUrl.startsWith('/media/')))
      && asset.properties && typeof asset.properties === 'object')
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, done) => done(null, mediaDir),
    filename: (_request, file, done) => done(null, `${randomUUID()}${extname(file.originalname).toLowerCase() || '.png'}`),
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

const app = express()
app.use(express.json({ limit: '5mb' }))
app.use('/media', express.static(mediaDir, { immutable: true, maxAge: '1y' }))
app.use('/source-media', express.static(sourceImgDir, { maxAge: '1h', fallthrough: false }))

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/source-assets', async (request, response, next) => {
  try {
    const allAssets = await getSourceIndex()
    const groups = [...new Set(allAssets.map((asset) => asset.group))]
    const group = typeof request.query.group === 'string' ? request.query.group : ''
    const variant = typeof request.query.variant === 'string' ? request.query.variant : ''
    const query = typeof request.query.q === 'string' ? request.query.q.trim().toLocaleLowerCase() : ''
    const filtered = allAssets.filter((asset) => (!group || asset.group === group)
      && (!variant || asset.variant === variant)
      && (!query || asset.name.toLocaleLowerCase().includes(query) || asset.relativePath.toLocaleLowerCase().includes(query)))
    const limit = Math.min(120, Math.max(1, Number.parseInt(String(request.query.limit || '60'), 10) || 60))
    const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0)
    const groupCounts = Object.fromEntries(groups.map((name) => [name, allAssets.filter((asset) => asset.group === name).length]))
    const variants = [...new Set(allAssets.filter((asset) => !group || asset.group === group).map((asset) => asset.variant))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
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
app.get('/api/database-status', async (_request, response) => {
  try {
    const pool = await getDatabasePool()
    const [rows] = await pool.query('SELECT 1 AS connected')
    response.json({ connected: rows[0]?.connected === 1 })
  } catch (error) {
    const message = error.code === 'ER_DBACCESS_DENIED_ERROR'
      ? 'MariaDB phản hồi nhưng user trong compose chưa có quyền đọc database nsoshare.'
      : error.code === 'ER_BAD_DB_ERROR'
        ? 'MariaDB phản hồi nhưng chưa có database nsoshare.'
        : 'Chưa kết nối được MariaDB. Kiểm tra service mariadb và cổng 3306.'
    response.json({ connected: false, message })
  }
})
app.get('/api/sprite-metadata', async (request, response) => {
  const group = typeof request.query.group === 'string' ? request.query.group : ''
  const id = Number.parseInt(String(request.query.id || ''), 10)
  const tables = {
    Mob: { table: 'monster', fields: 'id, name, sprites, frames, sequence' },
    Effect: { table: 'effect_data', fields: 'id, sprites, frames, running' },
    EffectAuto: { table: 'effect_data_auto', fields: 'id, sprites, frames, running' },
  }
  const definition = tables[group]
  if (!definition || !Number.isSafeInteger(id) || id < 0) {
    response.status(400).json({ error: 'Không có metadata sprite cho asset này.' })
    return
  }
  try {
    const pool = await getDatabasePool()
    const [rows] = await pool.execute(`SELECT ${definition.fields} FROM ${definition.table} WHERE id = ? LIMIT 1`, [id])
    const row = rows[0]
    if (!row) {
      response.status(404).json({ error: 'Không tìm thấy metadata sprite trong MariaDB.' })
      return
    }
    const metadata = Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (typeof value !== 'string' || !['sprites', 'frames', 'sequence', 'running'].includes(key)) return [key, value]
      try { return [key, JSON.parse(value)] } catch { return [key, value] }
    }))
    response.json(metadata)
  } catch {
    response.status(503).json({ error: 'MariaDB chưa sẵn sàng hoặc schema không tương thích.' })
  }
})
app.get('/api/project', async (_request, response, next) => {
  try {
    response.json(await readProject())
  } catch (error) {
    next(error)
  }
})
app.put('/api/project', async (request, response, next) => {
  try {
    if (!isProject(request.body)) {
      response.status(400).json({ error: 'Project JSON không đúng cấu trúc hoặc dữ liệu map không hợp lệ.' })
      return
    }
    await writeProject(request.body)
    response.json({ status: 'saved' })
  } catch (error) {
    next(error)
  }
})
app.post('/api/media', (request, response, next) => {
  upload.single('image')(request, response, async (error) => {
    if (error) {
      response.status(400).json({ error: error.message })
      return
    }
    if (!request.file) {
      response.status(400).json({ error: 'Chưa chọn ảnh PNG.' })
      return
    }
    const header = await readFile(request.file.path).then((data) => data.subarray(0, 8)).catch(() => Buffer.alloc(0))
    if (!header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      await unlink(request.file.path).catch(() => undefined)
      response.status(400).json({ error: 'File không có chữ ký ảnh PNG hợp lệ.' })
      return
    }
    response.status(201).json({ imageUrl: `/media/${request.file.filename}` })
  })
})

app.get('/api/export', async (_request, response, next) => {
  try {
    const project = await readProject()
    response.setHeader('Content-Disposition', 'attachment; filename="game-project.json"')
    response.json(project)
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
  console.error(error)
  response.status(500).json({ error: 'Lỗi nội bộ khi đọc hoặc ghi project.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Game Asset Studio API: http://127.0.0.1:${port}`)
  console.log(`Project folder: ${projectDir}`)
})
