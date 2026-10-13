import mysql from 'mysql2/promise'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

let pool = null

export async function getDbPool() {
  if (pool) return pool

  // Ưu tiên biến môi trường, sau đó đọc từ docker-compose.yml hoặc mysql.properties
  let host = process.env.ASSET_STUDIO_DB_HOST || (process.env.ASSET_STUDIO_IN_DOCKER === '1' ? 'mariadb' : '127.0.0.1')
  let port = Number(process.env.ASSET_STUDIO_DB_PORT || 3306)
  let database = process.env.ASSET_STUDIO_DB_NAME || 'nsoshare'
  let user = process.env.ASSET_STUDIO_DB_USER || 'root'
  let password = process.env.ASSET_STUDIO_DB_PASSWORD || 'NsoRoot2026'

  pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 4,
    connectTimeout: 3000,
  })

  return pool
}

function parseJsonSafe(val, fallback = []) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

// ==================== MAP QUERIES ====================

export async function getAllMaps() {
  const p = await getDbPool()
  const [rows] = await p.query(
    'SELECT id, name, tileId, bgId, type, zone_number FROM map ORDER BY id ASC'
  )
  return rows
}

export async function getMapById(id) {
  const p = await getDbPool()
  const [rows] = await p.execute('SELECT * FROM map WHERE id = ? LIMIT 1', [id])
  const row = rows[0]
  if (!row) return null

  return {
    ...row,
    npc: parseJsonSafe(row.npc),
    waypoint: parseJsonSafe(row.waypoint),
    monster: parseJsonSafe(row.monster),
    locationStand: parseJsonSafe(row.locationStand),
    item: parseJsonSafe(row.item),
    behind: parseJsonSafe(row.behind),
    betwen: parseJsonSafe(row.betwen),
    front: parseJsonSafe(row.front),
  }
}

export async function updateMapInDb(id, data) {
  const p = await getDbPool()
  const fields = [
    'name = ?',
    'tileId = ?',
    'bgId = ?',
    'type = ?',
    'zone_number = ?',
    'npc = ?',
    'waypoint = ?',
    'monster = ?',
    'locationStand = ?',
    'behind = ?',
    'betwen = ?',
    'front = ?',
  ]
  const values = [
    data.name,
    data.tileId,
    data.bgId,
    data.type,
    data.zone_number ?? 30,
    JSON.stringify(data.npc || []),
    JSON.stringify(data.waypoint || []),
    JSON.stringify(data.monster || []),
    JSON.stringify(data.locationStand || []),
    JSON.stringify(data.behind || []),
    JSON.stringify(data.betwen || []),
    JSON.stringify(data.front || []),
    id,
  ]
  await p.execute(`UPDATE map SET ${fields.join(', ')} WHERE id = ?`, values)
  return { success: true }
}

// ==================== ITEM & MOUNT QUERIES ====================

export async function getItemsList({ type, isMount, query, offset = 0, limit = 50 }) {
  const p = await getDbPool()
  const conditions = []
  const values = []

  if (isMount) {
    conditions.push('type BETWEEN 29 AND 33')
  } else if (type !== undefined && type !== null && type !== '') {
    conditions.push('type = ?')
    values.push(Number(type))
  }

  if (query) {
    conditions.push('(name LIKE ? OR id = ?)')
    values.push(`%${query}%`, Number.parseInt(query, 10) || -1)
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRows] = await p.query(`SELECT COUNT(*) AS total FROM item ${whereSql}`, values)
  const total = countRows[0].total

  const [rows] = await p.query(
    `SELECT id, name, type, gender, level, icon, part, fashion, isUpToUp, description 
     FROM item ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  )

  return { total, items: rows, offset, limit }
}

export async function getItemById(id) {
  const p = await getDbPool()
  const [rows] = await p.execute('SELECT * FROM item WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

export async function updateItemInDb(id, data) {
  const p = await getDbPool()
  const fields = [
    'name = ?',
    'type = ?',
    'gender = ?',
    'level = ?',
    'icon = ?',
    'part = ?',
    'fashion = ?',
    'description = ?',
    'isUpToUp = ?',
  ]
  const values = [
    data.name,
    data.type,
    data.gender,
    data.level,
    data.icon,
    data.part,
    data.fashion,
    data.description || '',
    data.isUpToUp ? 1 : 0,
    id,
  ]
  await p.execute(`UPDATE item SET ${fields.join(', ')} WHERE id = ?`, values)
  return { success: true }
}

export async function getAllItemOptionTemplates() {
  const p = await getDbPool()
  const [rows] = await p.query('SELECT * FROM item_option ORDER BY id ASC')
  return rows
}

// ==================== PART & AVATAR QUERIES ====================

export async function getAllParts(type = null) {
  const p = await getDbPool()
  let sql = 'SELECT * FROM nj_part'
  const values = []
  if (type !== null && type !== undefined) {
    sql += ' WHERE type = ?'
    values.push(Number(type))
  }
  sql += ' ORDER BY id ASC'

  const [rows] = await p.execute(sql, values)
  return rows.map((r) => ({
    ...r,
    part: parseJsonSafe(r.part),
  }))
}

export async function getAllImages() {
  const p = await getDbPool()
  const [rows] = await p.query('SELECT * FROM nj_image ORDER BY id ASC')
  return rows.map((r) => {
    let small = [0, 0, 0, 0, 0]
    try {
      const parsed = JSON.parse(r.smallImage)
      if (Array.isArray(parsed)) {
        small = parsed
      } else if (parsed && typeof parsed === 'object') {
        small = [parsed.id || 0, parsed.x || 0, parsed.y || 0, parsed.w || 0, parsed.h || 0]
      }
    } catch {}
    return {
      id: r.id,
      smallImage: small,
    }
  })
}

export async function updatePartInDb(id, type, partFrames) {
  const p = await getDbPool()
  await p.execute('UPDATE nj_part SET type = ?, part = ? WHERE id = ?', [
    type,
    JSON.stringify(partFrames),
    id,
  ])
  return { success: true }
}

// ==================== MONSTER & EFFECT QUERIES ====================

export async function getMonstersList({ query, offset = 0, limit = 50 }) {
  const p = await getDbPool()
  const conditions = []
  const values = []

  if (query) {
    conditions.push('(name LIKE ? OR id = ?)')
    values.push(`%${query}%`, Number.parseInt(query, 10) || -1)
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const [countRows] = await p.query(`SELECT COUNT(*) AS total FROM monster ${whereSql}`, values)
  const total = countRows[0].total

  const [rows] = await p.query(
    `SELECT id, name, level, boss, type, hp, speed, n_img, (sprites IS NOT NULL AND JSON_LENGTH(sprites) > 0) AS is_composite FROM monster ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  )

  return { total, monsters: rows, offset, limit }
}

export async function getMonsterById(id) {
  const p = await getDbPool()
  const [rows] = await p.execute('SELECT * FROM monster WHERE id = ? LIMIT 1', [id])
  const row = rows[0]
  if (!row) return null

  const parsedSprites = parseJsonSafe(row.sprites) || []
  const parsedFrames = parseJsonSafe(row.frames) || []

  return {
    ...row,
    move: parseJsonSafe(row.move) || [],
    attack: parseJsonSafe(row.attack) || [],
    sprites: parsedSprites,
    frames: parsedFrames,
    sequence: parseJsonSafe(row.sequence) || [],
    frame_char: parseJsonSafe(row.frame_char) || [],
    index_splash: parseJsonSafe(row.index_splash) || [],
    is_composite: parsedSprites.length > 0 && parsedFrames.length > 0 ? 1 : 0,
  }
}

export async function updateMonsterInDb(id, data) {
  const p = await getDbPool()
  const fields = [
    'name = ?',
    'level = ?',
    'boss = ?',
    'type = ?',
    'hp = ?',
    'range_move = ?',
    'speed = ?',
    'type_fly = ?',
    'n_img = ?',
    'move = ?',
    'attack = ?',
    'sprites = ?',
    'frames = ?',
    'sequence = ?',
  ]
  const values = [
    data.name,
    data.level || 0,
    data.boss ? 1 : 0,
    data.type || 0,
    data.hp || 1000,
    data.range_move || 30,
    data.speed || 2,
    data.type_fly || 0,
    data.n_img || 1,
    JSON.stringify(data.move || []),
    JSON.stringify(data.attack || []),
    JSON.stringify(data.sprites || []),
    JSON.stringify(data.frames || []),
    JSON.stringify(data.sequence || []),
    id,
  ]
  await p.execute(`UPDATE monster SET ${fields.join(', ')} WHERE id = ?`, values)
  return { success: true }
}
