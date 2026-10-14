<script setup lang="ts">
import type { NsoPartImage } from '../../types/nso'
import type { CharacterCategory, ActionStepItem } from '../../types/character'

const props = defineProps<{
  zoom: number
  flipHorizontal: boolean
  showGuides: boolean
  showGroundShadow: boolean
  weaponLayerOrder: 'behind' | 'front'
  groundY: number
  stageCenterX: number
  effectiveWaistOverlap: number
  effectiveNeckOverlap: number
  activeEditCategory: CharacterCategory
  canvasLegFrame: NsoPartImage | null
  canvasBodyFrame: NsoPartImage | null
  canvasHeadFrame: NsoPartImage | null
  canvasWeaponFrame: NsoPartImage | null
  canvasMaskFrame: NsoPartImage | null
  legPos: { top: number; left: number; w: number; h: number }
  bodyPos: { top: number; left: number; w: number; h: number }
  headPos: { top: number; left: number; w: number; h: number }
  weaponPos: { top: number; left: number; w: number; h: number }
  weaponAnimOffset: { dx: number; dy: number; rot: number }
  lungeOffset: number
  groundShadowScale: number
  groundShadowOpacity: number
  isDragging: boolean
  currentStepData?: ActionStepItem | null
}>()

const emit = defineEmits<{
  (e: 'start-drag', evt: MouseEvent): void
  (e: 'select-category', cat: CharacterCategory): void
  (e: 'image-loaded', id: number, evt: Event): void
}>()

function getPartZIndex(category: CharacterCategory | 'mask'): number {
  const zIndices = props.currentStepData?.zIndices
  const userZ = (zIndices && typeof zIndices[category] === 'number') ? zIndices[category]! : 1
  const tieBreakers: Record<CharacterCategory | 'mask', number> = {
    leg: 20,
    body: 30,
    weapon: props.weaponLayerOrder === 'behind' ? 15 : 35,
    head: 40,
    mask: 50,
  }
  return (userZ * 100) + tieBreakers[category]
}
</script>

<template>
  <div
    class="stage-container"
    @mousedown="emit('start-drag', $event)"
    :class="{ dragging: isDragging }"
  >
    <div
      class="stage-canvas-box"
      :style="{
        transform: `scale(${zoom}) ${flipHorizontal ? 'scaleX(-1)' : ''}`,
      }"
    >
      <!-- Ground Shadow -->
      <div
        v-if="showGroundShadow"
        class="ground-shadow"
        :style="{
          top: `${groundY - 8}px`,
          transform: `translateX(calc(-50% + ${Math.round(lungeOffset * 0.5)}px)) scale(${groundShadowScale})`,
          opacity: groundShadowOpacity,
        }"
      />

      <!-- Vạch căn chuẩn Visual Alignment Guides -->
      <template v-if="showGuides">
        <!-- Vạch trục giữa X=0 -->
        <div class="guide-line-v" :style="{ left: `${stageCenterX}px` }">
          <span class="guide-tag-top">Tim X=0</span>
        </div>
        <!-- Vạch sàn đất Y=0 -->
        <div class="guide-line-h" :style="{ top: `${groundY}px` }">
          <span class="guide-tag-right">Đất Y=0</span>
        </div>
        <!-- Vạch khớp eo -->
        <div
          class="guide-line-joint"
          :style="{ top: `${bodyPos.top + bodyPos.h - effectiveWaistOverlap}px` }"
          title="Khớp Eo"
        />
        <!-- Vạch khớp cổ -->
        <div
          class="guide-line-joint"
          :style="{ top: `${bodyPos.top}px` }"
          title="Khớp Cổ"
        />
      </template>

      <!-- ==================== RENDER TỪNG LỚP BỘ PHẬN ==================== -->

      <!-- 1. Weapon Layer (Vũ khí / Kiếm) -->
      <div
        v-if="canvasWeaponFrame && canvasWeaponFrame.id > 0"
        class="part-render-box"
        :class="{ selected: activeEditCategory === 'weapon' }"
        :style="{
          top: `${weaponPos.top}px`,
          left: `${weaponPos.left}px`,
          transform: weaponAnimOffset.rot ? `rotate(${weaponAnimOffset.rot}deg)` : undefined,
          transformOrigin: '25% 75%',
          zIndex: getPartZIndex('weapon'),
        }"
        @click.stop="emit('select-category', 'weapon')"
      >
        <img
          :src="`/source-media/Small/${canvasWeaponFrame.id}.png`"
          class="pixel-img"
          :style="{ width: `${weaponPos.w}px`, height: `${weaponPos.h}px` }"
          @load="emit('image-loaded', canvasWeaponFrame.id, $event)"
        />
      </div>

      <!-- 2. Leg Layer (Chân) -->
      <div
        v-if="canvasLegFrame && canvasLegFrame.id > 0"
        class="part-render-box"
        :class="{ selected: activeEditCategory === 'leg' }"
        :style="{
          top: `${legPos.top}px`,
          left: `${legPos.left}px`,
          zIndex: getPartZIndex('leg'),
        }"
        @click.stop="emit('select-category', 'leg')"
      >
        <img
          :src="`/source-media/Small/${canvasLegFrame.id}.png`"
          class="pixel-img"
          :style="{ width: `${legPos.w}px`, height: `${legPos.h}px` }"
          @load="emit('image-loaded', canvasLegFrame.id, $event)"
        />
      </div>

      <!-- 3. Body Layer (Thân) -->
      <div
        v-if="canvasBodyFrame && canvasBodyFrame.id > 0"
        class="part-render-box"
        :class="{ selected: activeEditCategory === 'body' }"
        :style="{
          top: `${bodyPos.top}px`,
          left: `${bodyPos.left}px`,
          zIndex: getPartZIndex('body'),
        }"
        @click.stop="emit('select-category', 'body')"
      >
        <img
          :src="`/source-media/Small/${canvasBodyFrame.id}.png`"
          class="pixel-img"
          :style="{ width: `${bodyPos.w}px`, height: `${bodyPos.h}px` }"
          @load="emit('image-loaded', canvasBodyFrame.id, $event)"
        />
      </div>

      <!-- 4. Head Layer (Đầu / Nón / Tóc) -->
      <div
        v-if="canvasHeadFrame && canvasHeadFrame.id > 0"
        class="part-render-box"
        :class="{ selected: activeEditCategory === 'head' }"
        :style="{
          top: `${headPos.top}px`,
          left: `${headPos.left}px`,
          zIndex: getPartZIndex('head'),
        }"
        @click.stop="emit('select-category', 'head')"
      >
        <img
          :src="`/source-media/Small/${canvasHeadFrame.id}.png`"
          class="pixel-img"
          :style="{ width: `${headPos.w}px`, height: `${headPos.h}px` }"
          @load="emit('image-loaded', canvasHeadFrame.id, $event)"
        />
      </div>

      <!-- 5. Mask / Back Item Layer (Mặt nạ / Đeo lưng / Cánh) -->
      <div
        v-if="canvasMaskFrame && canvasMaskFrame.id > 0"
        class="part-render-box mask-box"
        :style="{
          top: `${headPos.top}px`,
          left: `${headPos.left}px`,
          zIndex: getPartZIndex('mask'),
        }"
      >
        <img
          :src="`/source-media/Small/${canvasMaskFrame.id}.png`"
          class="pixel-img"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background-color: #0E1214;
  /* Pixel Grid Checkerboard */
  background-image:
    linear-gradient(45deg, #141A1C 25%, transparent 25%),
    linear-gradient(-45deg, #141A1C 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #141A1C 75%),
    linear-gradient(-45deg, transparent 75%, #141A1C 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0px;
  cursor: grab;
  user-select: none;
}

.stage-container.dragging {
  cursor: grabbing;
}

.stage-canvas-box {
  width: 260px;
  height: 320px;
  position: relative;
  transform-origin: center center;
  transition: transform 0.05s ease-out;
}

/* Ground Shadow */
.ground-shadow {
  position: absolute;
  left: 130px;
  width: 54px;
  height: 14px;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
  transition: all 0.1s ease;
}

/* Guidelines */
.guide-line-v {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: rgba(185, 243, 107, 0.25);
  pointer-events: none;
  z-index: 10;
}

.guide-tag-top {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 8px;
  color: #B9F36B;
  opacity: 0.6;
  font-family: monospace;
}

.guide-line-h {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background-color: rgba(241, 167, 115, 0.35);
  pointer-events: none;
  z-index: 10;
}

.guide-tag-right {
  position: absolute;
  right: 4px;
  top: -12px;
  font-size: 8px;
  color: #F1A773;
  opacity: 0.7;
  font-family: monospace;
}

.guide-line-joint {
  position: absolute;
  left: 40px;
  right: 40px;
  height: 1px;
  background-color: rgba(243, 202, 107, 0.4);
  border-top: 1px dashed #F3CA6B;
  pointer-events: none;
  z-index: 10;
}

/* Part Render Box */
.part-render-box {
  position: absolute;
  z-index: 2;
  cursor: pointer;
  transition: transform 0.08s ease;
}

.part-render-box.selected {
  outline: 1px dashed #B9F36B;
  outline-offset: 1px;
}

.pixel-img {
  image-rendering: pixelated;
  display: block;
}

.mask-box {
  z-index: 3;
  pointer-events: none;
}
</style>
