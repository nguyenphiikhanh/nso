import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * Đọc file nhị phân map NSO từ Data/Map/{id}
 * @param {string} dataMapDir Đường dẫn thư mục Data/Map
 * @param {number|string} mapId ID của map
 * @returns {Promise<{ id: number, tmw: number, tmh: number, tiles: number[], key: number }>}
 */
export async function readMapBinary(dataMapDir, mapId) {
  const filePath = join(dataMapDir, String(mapId))
  const buf = await readFile(filePath)
  let offset = 0
  let key = 0

  const b0 = buf.readInt8(0)
  const b1 = buf.readInt8(1)
  if (b0 + b1 === 0) {
    key = b0
    offset = 2
  }

  const tmw = (buf.readUInt8(offset++) - key) & 0xff
  const tmh = (buf.readUInt8(offset++) - key) & 0xff
  const total = tmw * tmh
  const tiles = new Array(total)

  for (let i = 0; i < total; i++) {
    tiles[i] = (buf.readUInt8(offset++) - key) & 0xff
  }

  return {
    id: Number(mapId),
    tmw,
    tmh,
    tiles,
    key,
  }
}

/**
 * Ghi file nhị phân map NSO vào Data/Map/{id} (có tạo bản sao lưu)
 * @param {string} dataMapDir Đường dẫn thư mục Data/Map
 * @param {string} backupDir Đường dẫn thư mục backup
 * @param {number|string} mapId ID của map
 * @param {number} tmw Chiều rộng tính theo số ô tile
 * @param {number} tmh Chiều cao tính theo số ô tile
 * @param {number[]} tiles Mảng 1 chiều chứa ID của tile
 * @param {number} [key=0] Key mã hóa (mặc định 0)
 */
export async function writeMapBinary(dataMapDir, backupDir, mapId, tmw, tmh, tiles, key = 0) {
  const filePath = join(dataMapDir, String(mapId))

  // 1. Sao lưu nếu file đã tồn tại
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const mapBackupDir = join(backupDir, 'maps')
    await mkdir(mapBackupDir, { recursive: true })
    const backupPath = join(mapBackupDir, `${mapId}_${timestamp}.bak`)
    await copyFile(filePath, backupPath)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  // 2. Biên dịch Buffer theo định dạng TileMap.java
  const totalTiles = tmw * tmh
  if (tiles.length !== totalTiles) {
    throw new Error(`Kích thước mảng tile (${tiles.length}) không khớp tmw*tmh (${totalTiles})`)
  }

  const headerSize = key !== 0 ? 4 : 4
  const buf = Buffer.alloc(headerSize + totalTiles)
  let offset = 0

  if (key !== 0) {
    buf.writeInt8(key, offset++)
    buf.writeInt8(-key, offset++)
  } else {
    buf.writeUInt8(0, offset++)
    buf.writeUInt8(0, offset++)
  }

  buf.writeUInt8((tmw + key) & 0xff, offset++)
  buf.writeUInt8((tmh + key) & 0xff, offset++)

  for (let i = 0; i < totalTiles; i++) {
    buf.writeUInt8((tiles[i] + key) & 0xff, offset++)
  }

  await writeFile(filePath, buf)
  return { success: true, size: buf.length }
}
