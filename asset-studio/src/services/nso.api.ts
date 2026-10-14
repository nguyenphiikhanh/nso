import type {
  NsoMapSummary,
  NsoMapDetail,
  NsoItem,
  NsoItemOptionTemplate,
  NsoPart,
  NsoMonsterSummary,
  NsoMonsterDetail,
  ChangesetSummary,
} from '../types/nso'

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || `Yêu cầu thất bại (${response.status})`)
  }
  return response.json()
}

// Maps
export function fetchAllMaps(): Promise<NsoMapSummary[]> {
  return requestJson<NsoMapSummary[]>('/api/maps')
}

export function fetchMapDetail(id: number): Promise<NsoMapDetail> {
  return requestJson<NsoMapDetail>(`/api/maps/${id}`)
}

export function saveMapDraft(id: number, data: Partial<NsoMapDetail>): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/api/maps/${id}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// Items & Mounts
export function fetchItemsList(params: {
  isMount?: boolean
  type?: number | string
  q?: string
  offset?: number
  limit?: number
}): Promise<{ total: number; offset: number; limit: number; items: NsoItem[] }> {
  const qry = new URLSearchParams()
  if (params.isMount) qry.set('isMount', 'true')
  if (params.type !== undefined && params.type !== '') qry.set('type', String(params.type))
  if (params.q) qry.set('q', params.q)
  if (params.offset) qry.set('offset', String(params.offset))
  if (params.limit) qry.set('limit', String(params.limit))
  return requestJson(`/api/items?${qry.toString()}`)
}

export function fetchItemDetail(id: number): Promise<NsoItem> {
  return requestJson<NsoItem>(`/api/items/${id}`)
}

export function saveItemDraft(id: number, data: Partial<NsoItem>): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/api/items/${id}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function fetchItemOptions(): Promise<NsoItemOptionTemplate[]> {
  return requestJson<NsoItemOptionTemplate[]>('/api/item-options')
}

// Parts & Avatars
export function fetchAllParts(type?: number): Promise<NsoPart[]> {
  const url = type !== undefined ? `/api/parts?type=${type}` : '/api/parts'
  return requestJson<NsoPart[]>(url)
}

export function fetchAllImages(): Promise<Array<{ id: number; smallImage: number[] }>> {
  return requestJson('/api/images')
}

export function savePartDraft(
  id: number,
  data: { type: number; part: any[] }
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/api/parts/${id}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function createCustomPartFromSlices(data: {
  name: string
  type: number
  slices: Array<{ dataUrl: string; dx?: number; dy?: number }>
}): Promise<{ status: string; part: NsoPart }> {
  return requestJson<{ status: string; part: NsoPart }>('/api/custom-parts/slice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function resizePartFrameImage(data: {
  smallId: number
  dataUrl: string
  targetW: number
  targetH: number
  partId?: number
}): Promise<{ status: string; smallId: number; w: number; h: number }> {
  return requestJson<{ status: string; smallId: number; w: number; h: number }>(
    '/api/custom-parts/resize-frame',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
}


// Monsters & Animations
export function fetchMonstersList(params: {
  q?: string
  offset?: number
  limit?: number
}): Promise<{ total: number; offset: number; limit: number; monsters: NsoMonsterSummary[] }> {
  const qry = new URLSearchParams()
  if (params.q) qry.set('q', params.q)
  if (params.offset) qry.set('offset', String(params.offset))
  if (params.limit) qry.set('limit', String(params.limit))
  return requestJson(`/api/monsters?${qry.toString()}`)
}

export function fetchMonsterDetail(id: number): Promise<NsoMonsterDetail> {
  return requestJson<NsoMonsterDetail>(`/api/monsters/${id}`)
}

export function saveMonsterDraft(
  id: number,
  data: Partial<NsoMonsterDetail>
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/api/monsters/${id}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// Draft & Deploy
export function fetchDraftSummary(): Promise<ChangesetSummary> {
  return requestJson<ChangesetSummary>('/api/draft')
}

export function revertDraftItem(category: string, id: number): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/api/draft/${category}/${id}`, {
    method: 'DELETE',
  })
}

export function clearAllDraft(): Promise<{ status: string }> {
  return requestJson<{ status: string }>('/api/draft/clear', {
    method: 'POST',
  })
}

export function deployDraftToGame(): Promise<{ status: string; backupPath: string }> {
  return requestJson<{ status: string; backupPath: string }>('/api/draft/deploy', {
    method: 'POST',
  })
}

// Export Package
export function exportPackage(params: {
  target: 'server' | 'unity' | 'modpack'
  selectedIds?: any
}): Promise<{ success: boolean; exportId: string; filename: string; downloadUrl: string }> {
  return requestJson('/api/export-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

// Export Character Unity Package (Option D Hybrid)
export function exportCharacterUnityPackage(payload: {
  loadout: any
  actionSequences?: any
  actionName?: string
  actionSequence?: any
  waistOverlap: number
  neckOverlap: number
  fps: number
  parts: any[]
}): Promise<{ success: boolean; exportId: string; filename: string; downloadUrl: string; copiedSprites: number }> {
  return requestJson('/api/export-character-unity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// Check database status
export function checkDbStatus(): Promise<{ connected: boolean; message?: string }> {
  return requestJson('/api/database-status')
}
