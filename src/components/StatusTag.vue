<script setup lang="ts">
import { computed } from 'vue'
import { statusMeta } from '@/constants/status'

const props = defineProps<{ kind: string; status: string }>()
const meta = computed(() => statusMeta(props.kind, props.status))
</script>

<template>
  <span class="chip" :class="`chip--${meta.tone}`">{{ meta.label }}</span>
</template>
