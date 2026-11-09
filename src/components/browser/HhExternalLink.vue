<script setup lang="ts">
import { ref } from 'vue'
import { openHhUrl } from '../../services/hhBrowserNavigation'

const props = defineProps<{ href: string; focusExisting?: boolean }>()
const opening = ref(false)

async function open(event: MouseEvent): Promise<void> {
  event.preventDefault()
  if (opening.value) return
  opening.value = true
  try {
    await openHhUrl(props.href, props.focusExisting)
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <a href="#" :aria-busy="opening" @click="open"><slot /></a>
</template>
