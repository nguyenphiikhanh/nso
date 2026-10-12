import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeMapBinary, readMapBinary } from './mapBinary.mjs'
import {
  updateMapInDb,
  updateItemInDb,
  updatePartInDb,
  updateMonsterInDb,
  getMapById,
  getItemById,
  getMonsterById,
  getDbPool,
} from './db.mjs'

export class ChangesetEngine {
  constructor(options) {
    this.draftFile = options.draftFile
    this.dataMapDir = options.dataMapDir
    this.backupDir = options.backupDir
  }

  async ensureDir() {
    await mkdir(resolve(this.draftFile, '..'), { recursive: true })
    await mkdir(this.backupDir, { recursive: true })
  }

  async getChangeset() {
    await this.ensureDir()
    try {
      const content = await readFile(this.draftFile, 'utf8')
      return JSON.parse(content)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      const empty = {
        version: 1,
        updatedAt: new Date().toISOString(),
        maps: {},
        items: {},
        parts: {},
        monsters: {},
      }
      await this.saveChangeset(empty)
      return empty
    }
  }

  async saveChangeset(changeset) {
    await this.ensureDir()
    changeset.updatedAt = new Date().toISOString()
    const tempFile = `${this.draftFile}.${randomUUID()}.tmp`
    await writeFile(tempFile, JSON.stringify(changeset, null, 2), 'utf8')
    await rename(tempFile, this.draftFile)
  }

  async updateEntity(category, id, data) {
    const cs = await this.getChangeset()
    if (!cs[category]) cs[category] = {}
    cs[category][String(id)] = {
      ...data,
      id: Number(id),
      _modifiedAt: new Date().toISOString(),
    }
    await this.saveChangeset(cs)
    return cs[category][String(id)]
  }

  async revertEntity(category, id) {
    const cs = await this.getChangeset()
    if (cs[category] && cs[category][String(id)]) {
      delete cs[category][String(id)]
      await this.saveChangeset(cs)
      return { success: true }
    }
    return { success: false, message: 'Không tìm thấy thay đổi trong bản nháp.' }
  }

  async clearChangeset() {
    const empty = {
      version: 1,
      updatedAt: new Date().toISOString(),
      maps: {},
      items: {},
      parts: {},
      monsters: {},
    }
    await this.saveChangeset(empty)
    return empty
  }

  async getSummary() {
    const cs = await this.getChangeset()
    const counts = {
      maps: Object.keys(cs.maps || {}).length,
      items: Object.keys(cs.items || {}).length,
      parts: Object.keys(cs.parts || {}).length,
      monsters: Object.keys(cs.monsters || {}).length,
    }
    const total = counts.maps + counts.items + counts.parts + counts.monsters

    return {
      updatedAt: cs.updatedAt,
      total,
      counts,
      changes: {
        maps: Object.values(cs.maps || {}).map((m) => ({ id: m.id, name: m.name })),
        items: Object.values(cs.items || {}).map((i) => ({ id: i.id, name: i.name, type: i.type })),
        parts: Object.values(cs.parts || {}).map((p) => ({ id: p.id, type: p.type })),
        monsters: Object.values(cs.monsters || {}).map((m) => ({ id: m.id, name: m.name })),
      },
    }
  }

  /**
   * Triển khai toàn bộ bản nháp vào hệ thống game thật (Data/Map + MariaDB)
   */
  async deployAll() {
    const cs = await this.getChangeset()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sessionBackupDir = join(this.backupDir, `deploy_${timestamp}`)
    await mkdir(sessionBackupDir, { recursive: true })

    const results = {
      deployedAt: new Date().toISOString(),
      maps: [],
      items: [],
      parts: [],
      monsters: [],
      backupPath: sessionBackupDir,
    }

    // 1. Deploy Maps
    for (const [idStr, mapData] of Object.entries(cs.maps || {})) {
      const id = Number(idStr)
      // Ghi binary nếu có dữ liệu tiles
      if (Array.isArray(mapData.tiles) && mapData.tmw && mapData.tmh) {
        await writeMapBinary(
          this.dataMapDir,
          sessionBackupDir,
          id,
          mapData.tmw,
          mapData.tmh,
          mapData.tiles
        )
      }
      // Update DB
      await updateMapInDb(id, mapData)
      results.maps.push(id)
    }

    // 2. Deploy Items
    for (const [idStr, itemData] of Object.entries(cs.items || {})) {
      const id = Number(idStr)
      await updateItemInDb(id, itemData)
      results.items.push(id)
    }

    // 3. Deploy Parts
    for (const [idStr, partData] of Object.entries(cs.parts || {})) {
      const id = Number(idStr)
      await updatePartInDb(id, partData.type, partData.part)
      results.parts.push(id)
    }

    // 4. Deploy Monsters
    for (const [idStr, mobData] of Object.entries(cs.monsters || {})) {
      const id = Number(idStr)
      await updateMonsterInDb(id, mobData)
      results.monsters.push(id)
    }

    // Xóa changeset sau khi deploy thành công
    await this.clearChangeset()

    return results
  }
}
