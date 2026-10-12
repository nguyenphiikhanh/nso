import type { NsoPart, NsoPartImage } from './nso'

export type CharacterCategory = 'head' | 'body' | 'leg' | 'weapon'
export type ActionType = 'idle' | 'walk' | 'attack' | 'jump'

export interface CharacterLoadout {
  headId: number
  bodyId: number
  legId: number
  weaponId: number
  maskId: number | null
}

export interface ActionStepItem {
  id: string
  name: string
  headFrame: number
  bodyFrame: number
  legFrame: number
  weaponFrame: number
  lungeX: number
  jumpY: number
  breathBob: number
  neckOffset?: number      // Bù độ lệch khớp Cổ (+/- px) riêng cho nhịp này
  waistOffset?: number     // Bù độ lệch khớp Eo (+/- px) riêng cho nhịp này
  headOffset?: { dx: number; dy: number }   // Bù vị trí Đầu (dx, dy) riêng cho nhịp này
  bodyOffset?: { dx: number; dy: number }   // Bù vị trí Thân (dx, dy) riêng cho nhịp này
  legOffset?: { dx: number; dy: number }    // Bù vị trí Chân (dx, dy) riêng cho nhịp này
  weaponOffset: { dx: number; dy: number; rot: number }
  shadowScale: number
  shadowOpacity: number
  zIndices?: {
    head?: number
    body?: number
    leg?: number
    weapon?: number
    mask?: number
  }
}

export interface ActionDefinitionItem {
  id: ActionType
  label: string
  icon: string
  fps: number
  steps: ActionStepItem[]
}

export interface ActionSequence {
  steps: number
  breathBob: number[]
  lungeX?: number[]
  jumpY?: number[]
  shadowScale?: number[]
  shadowOpacity?: number[]
  neckOffsets?: number[]
  waistOffsets?: number[]
  headOffsets?: { dx: number; dy: number }[]
  bodyOffsets?: { dx: number; dy: number }[]
  legOffsets?: { dx: number; dy: number }[]
  weaponOffsets?: { dx: number; dy: number; rot: number }[]
  zIndices?: Array<{
    head: number
    body: number
    leg: number
    weapon: number
    mask: number
  }>
  getHeadFrame: (s: number) => number
  getBodyFrame: (s: number) => number
  getLegFrame: (s: number) => number
  getWeaponFrame: (s: number) => number
}

