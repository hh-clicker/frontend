<script setup lang="ts">
import { IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-vue'

withDefaults(defineProps<{
  tone?: 'warning' | 'info'
  dismissible?: boolean
}>(), {
  tone: 'warning',
  dismissible: false,
})

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="app-alert" :class="`app-alert--${tone}`" role="status">
    <IconAlertTriangle v-if="tone === 'warning'" :size="20" aria-hidden="true" />
    <IconInfoCircle v-else :size="20" aria-hidden="true" />
    <div class="app-alert__content"><slot /></div>
    <button v-if="dismissible" class="icon-action" type="button" aria-label="Закрыть" @click="$emit('dismiss')">
      <IconX :size="18" />
    </button>
  </div>
</template>
