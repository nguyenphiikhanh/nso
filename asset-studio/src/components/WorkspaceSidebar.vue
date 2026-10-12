<script setup lang="ts">
import { assetKinds, type AssetKind } from '../types/project'

defineProps<{ active: AssetKind | 'map' | 'source'; counts: Record<AssetKind | 'map' | 'source', number> }>()
const emit = defineEmits<{ select: [value: AssetKind | 'map' | 'source'] }>()
</script>

<template>
  <nav class="workspace-sidebar" aria-label="Danh mục project">
    <button class="brand-mark" type="button" title="Game Asset Studio" aria-label="Game Asset Studio">G</button>
    <div class="nav-group">
      <button class="nav-item" :class="{ active: active === 'map' }" type="button" @click="emit('select', 'map')">
        <span class="nav-glyph map-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
        <span class="nav-label">Map</span>
        <span class="nav-count">{{ counts.map }}</span>
      </button>
      <button v-for="kind in assetKinds" :key="kind.id" class="nav-item" :class="{ active: active === kind.id }" type="button" @click="emit('select', kind.id)">
        <span class="nav-glyph" aria-hidden="true">{{ kind.shortLabel }}</span>
        <span class="nav-label">{{ kind.label }}</span>
        <span class="nav-count">{{ counts[kind.id] }}</span>
      </button>
      <button class="nav-item source-nav-item" :class="{ active: active === 'source' }" type="button" @click="emit('select', 'source')">
        <span class="nav-glyph" aria-hidden="true">DB</span>
        <span class="nav-label">Data gốc</span>
        <span class="nav-count">{{ counts.source ? counts.source.toLocaleString() : '—' }}</span>
      </button>
    </div>
    <div class="sidebar-bottom">
      <span class="online-dot" aria-hidden="true" />
      <span>LOCAL</span>
    </div>
  </nav>
</template>
