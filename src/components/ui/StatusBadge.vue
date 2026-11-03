<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  tone?: 'neutral' | 'blue' | 'green' | 'orange' | 'purple' | 'red'
  dot?: boolean
}>(), {
  tone: 'neutral',
  dot: true,
})
</script>

<template>
  <span class="status-badge" :class="`status-badge--${tone}`">
    <span v-if="dot" class="status-badge__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>
