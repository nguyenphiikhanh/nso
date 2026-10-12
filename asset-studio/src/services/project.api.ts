import type { GameProject, SourceAssetPage, SpriteMetadata } from '../types/project'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Yêu cầu thất bại (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function fetchProject() {
  return request<GameProject>('/api/project')
}

export function saveProject(project: GameProject) {
  return request<{ status: string }>('/api/project', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  })
}

export async function uploadPng(file: File) {
  const form = new FormData()
  form.append('image', file)
  return request<{ imageUrl: string }>('/api/media', { method: 'POST', body: form })
}

export function fetchSourceAssets(options: { group?: string; variant?: string; q?: string; offset?: number; limit?: number }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return request<SourceAssetPage>(`/api/source-assets?${params.toString()}`)
}

export function fetchSpriteMetadata(group: string, id: string) {
  const params = new URLSearchParams({ group, id })
  return request<SpriteMetadata>(`/api/sprite-metadata?${params.toString()}`)
}

export function fetchDatabaseStatus() {
  return request<{ connected: boolean; message?: string }>('/api/database-status')
}
