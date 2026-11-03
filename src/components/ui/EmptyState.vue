<script setup lang="ts">
import { IconInbox } from '@tabler/icons-vue'

defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="empty-state">
    <span class="empty-state__icon"><IconInbox :size="30" stroke-width="1.5" /></span>
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>
