<script setup lang="ts">
import type { Tone } from '@/types'

defineProps<{
  label: string
  value: string
  note?: string
  tone?: Tone
}>()
</script>

<template>
  <div class="metric-card">
    <div class="metric-label">
      <span>{{ label }}</span>
      <span class="dot" :class="`dot--${tone || 'muted'}`" />
    </div>
    <div class="metric-value">{{ value }}</div>
    <div v-if="note" class="metric-note">{{ note }}</div>
  </div>
</template>

<style scoped>
.dot--accent {
  background: var(--yxp-accent);
}
.dot--success {
  background: var(--yxp-success);
}
.dot--warning {
  background: var(--yxp-warning);
}
.dot--danger {
  background: var(--yxp-danger);
}
.dot--info {
  background: var(--yxp-info);
}
.dot--muted {
  background: var(--yxp-faint);
}
</style>
