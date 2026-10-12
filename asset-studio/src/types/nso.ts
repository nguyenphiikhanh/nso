export interface NsoMapSummary {
  id: number
  name: string
  tileId: number
  bgId: number
  type: number
  zone_number: number
  isDraft?: boolean
}

export interface NsoNpcSpawn {
  x: number
  y: number
  templateId: number
  status: number
}

export interface NsoWaypointSpawn {
  next: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  x: number
  y: number
}

export interface NsoMonsterSpawn {
  x: number
  y: number
  templateId: number
  boss?: boolean
  status?: number
}

export interface NsoMapDetail extends NsoMapSummary {
  tmw: number
  tmh: number
  tiles: number[]
  npc: NsoNpcSpawn[]
  waypoint: NsoWaypointSpawn[]
  monster: NsoMonsterSpawn[]
  locationStand: number[][]
  behind: any[]
  betwen: any[]
  front: any[]
}

export interface NsoItem {
  id: number
  name: string
  type: number
  gender: number
  level: number
  icon: number
  part: number
  fashion: number
  isUpToUp: boolean | number
  description: string
  isDraft?: boolean
}

export interface NsoItemOptionTemplate {
  id: number
  name: string
  type: number
}

export interface NsoPartImage {
  id: number
  dx: number
  dy: number
}

export interface NsoPart {
  id: number
  type: number // 0: Head, 1: Body, 2: Leg, 3: Weapon
  part: NsoPartImage[]
  isDraft?: boolean
}

export interface NsoSpriteSlice {
  id: number
  x: number
  y: number
  w: number
  h: number
}

export interface NsoFramePart {
  id: number
  dx: number
  dy: number
  flip: number
  onTop: number
}

export interface NsoMonsterDetail {
  id: number
  name: string
  level: number
  boss: boolean | number
  type: number
  hp: number
  range_move: number
  speed: number
  type_fly: number
  n_img: number
  move: number[]
  attack: number[][]
  sprites: NsoSpriteSlice[]
  frames: NsoFramePart[][]
  sequence: number[]
  isDraft?: boolean
}

export interface ChangesetCounts {
  maps: number
  items: number
  parts: number
  monsters: number
}

export interface ChangesetSummary {
  updatedAt: string
  total: number
  counts: ChangesetCounts
  changes: {
    maps: Array<{ id: number; name: string }>
    items: Array<{ id: number; name: string; type: number }>
    parts: Array<{ id: number; type: number }>
    monsters: Array<{ id: number; name: string }>
  }
}
