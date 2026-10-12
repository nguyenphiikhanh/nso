const starterTiles = [
  { id: 'tile-grass', name: 'Cỏ non', kind: 'tile', imageUrl: null, description: 'Nền đồng cỏ', properties: { terrain: 'Grass', collision: false, swatch: '#6f9f62' } },
  { id: 'tile-path', name: 'Đường đất', kind: 'tile', imageUrl: null, description: 'Lối đi đất nện', properties: { terrain: 'Dirt', collision: false, swatch: '#ae8057' } },
  { id: 'tile-water', name: 'Mặt nước', kind: 'tile', imageUrl: null, description: 'Vùng nước', properties: { terrain: 'Water', collision: true, swatch: '#568e9b' } },
  { id: 'tile-stone', name: 'Đá rêu', kind: 'tile', imageUrl: null, description: 'Nền đá', properties: { terrain: 'Stone', collision: false, swatch: '#82918a' } },
]

const width = 24
const height = 14
const tiles = Array(width * height).fill('tile-grass')
for (let x = 2; x < 22; x += 1) tiles[8 * width + x] = 'tile-path'
for (let y = 4; y < 8; y += 1) tiles[y * width + 17] = 'tile-path'
for (let y = 1; y < 5; y += 1) {
  for (let x = 1; x < 5; x += 1) tiles[y * width + x] = 'tile-water'
}

export function createDefaultProject() {
  return {
    version: 1,
    name: 'My 2D Game',
    assets: [
      ...starterTiles,
      { id: 'item-health-potion', name: 'Bình hồi phục', kind: 'item', imageUrl: null, description: 'Hồi phục một phần sinh lực.', properties: { rarity: 'Common', itemType: 'Consumable', stackSize: 99 } },
      { id: 'character-villager', name: 'Dân làng', kind: 'character', imageUrl: null, description: 'Nhân vật thân thiện trong khu làng.', properties: { role: 'NPC', level: 1, hp: 80 } },
      { id: 'outfit-traveler', name: 'Áo lữ khách', kind: 'outfit', imageUrl: null, description: 'Trang phục dành cho hành trình dài.', properties: { slot: 'Body', defense: 2 } },
      { id: 'mount-fox', name: 'Cáo lửa', kind: 'mount', imageUrl: null, description: 'Thú cưỡi nhanh nhẹn.', properties: { speed: 120, jump: 1 } },
    ],
    maps: [
      { id: 'map-green-hollow', name: 'Thung lũng xanh', width, height, tileSize: 32, tiles },
      { id: 'map-village-gate', name: 'Cổng làng', width: 18, height: 12, tileSize: 32, tiles: Array(18 * 12).fill('tile-grass') },
    ],
  }
}
