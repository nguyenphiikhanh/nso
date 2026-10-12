export type AssetKind = 'tile' | 'item' | 'character' | 'outfit' | 'mount'

export interface GameAsset {
  id: string
  name: string
  kind: AssetKind
  imageUrl: string | null
  description: string
  properties: Record<string, string | number | boolean>
}

export interface GameMap {
  id: string
  name: string
  width: number
  height: number
  tileSize: number
  tiles: Array<string | null>
}

export interface GameProject {
  version: 1
  name: string
  assets: GameAsset[]
  maps: GameMap[]
}

export interface SourceAsset {
  id: string
  name: string
  group: string
  variant: string
  relativePath: string
  url: string
}

export interface SourceAssetPage {
  rootAvailable: boolean
  total: number
  offset: number
  limit: number
  groups: Array<{ name: string; count: number }>
  variants: string[]
  assets: SourceAsset[]
}

export interface SpriteMetadata {
  id: number
  name?: string
  sprites?: Array<{ id: number; x: number; y: number; w: number; h: number }>
  frames?: unknown[]
  sequence?: number[]
  running?: number[]
}

export const assetKinds: Array<{ id: AssetKind; label: string; shortLabel: string }> = [
  { id: 'tile', label: 'Tiles', shortLabel: 'TL' },
  { id: 'item', label: 'Vật phẩm', shortLabel: 'VP' },
  { id: 'character', label: 'Nhân vật', shortLabel: 'NV' },
  { id: 'outfit', label: 'Trang phục', shortLabel: 'TP' },
  { id: 'mount', label: 'Thú cưỡi', shortLabel: 'TC' },
]

export const propertyDefinitions: Record<AssetKind, Array<{ key: string; label: string; type: 'text' | 'number' | 'boolean' }>> = {
  tile: [
    { key: 'terrain', label: 'Loại địa hình', type: 'text' },
    { key: 'collision', label: 'Chặn di chuyển', type: 'boolean' },
    { key: 'swatch', label: 'Màu mẫu', type: 'text' },
  ],
  item: [
    { key: 'itemType', label: 'Nhóm vật phẩm', type: 'text' },
    { key: 'rarity', label: 'Độ hiếm', type: 'text' },
    { key: 'stackSize', label: 'Số lượng tối đa', type: 'number' },
  ],
  character: [
    { key: 'role', label: 'Vai trò', type: 'text' },
    { key: 'level', label: 'Cấp độ', type: 'number' },
    { key: 'hp', label: 'Sinh lực', type: 'number' },
  ],
  outfit: [
    { key: 'slot', label: 'Vị trí trang bị', type: 'text' },
    { key: 'defense', label: 'Phòng thủ', type: 'number' },
  ],
  mount: [
    { key: 'speed', label: 'Tốc độ', type: 'number' },
    { key: 'jump', label: 'Độ nhảy', type: 'number' },
  ],
}

export const assetKindLabels: Record<AssetKind, string> = {
  tile: 'Tile',
  item: 'Vật phẩm',
  character: 'Nhân vật',
  outfit: 'Trang phục',
  mount: 'Thú cưỡi',
}
