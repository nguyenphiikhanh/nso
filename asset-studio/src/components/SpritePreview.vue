<script setup lang="ts">
import type { GameAsset } from '../types/project'

defineProps<{ asset: GameAsset }>()
</script>

<template>
  <div class="sprite-preview-area">
    <div class="preview-toolbar"><span>ASSET PREVIEW</span><span class="preview-zoom">1×</span></div>
    <div class="sprite-stage checkerboard">
      <img v-if="asset.imageUrl" :src="asset.imageUrl" :alt="asset.name" />
      <div v-else class="preview-placeholder">
        <span class="placeholder-shape">{{ asset.name.slice(0, 1).toLocaleUpperCase() }}</span>
        <strong>{{ asset.name }}</strong>
        <small>Import PNG để xem sprite</small>
      </div>
      <span class="stage-crosshair crosshair-h" />
      <span class="stage-crosshair crosshair-v" />
    </div>
    <div class="preview-footer"><span>{{ asset.id }}</span><span v-if="asset.imageUrl">PNG SPRITE</span><span v-else>NO IMAGE</span></div>
  </div>
</template>
