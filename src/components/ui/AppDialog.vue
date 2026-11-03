<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId, useSlots } from 'vue'
import { IconX } from '@tabler/icons-vue'

withDefaults(defineProps<{
  title: string
  description?: string
  size?: 'small' | 'medium' | 'large'
  layout?: 'default' | 'centered'
  tone?: 'neutral' | 'primary' | 'warning' | 'danger' | 'info'
  hideBody?: boolean
}>(), {
  description: '', size: 'medium', layout: 'default', tone: 'neutral', hideBody: false,
})

const emit = defineEmits<{ close: [] }>()
const slots = useSlots()
const titleId = `app-dialog-title-${useId().replaceAll(':', '')}`
const dialog = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let pressedOnBackdrop = false
let releasedOnBackdrop = false

function onKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') emit('close') }
function onBackdropPointerDown(event: PointerEvent): void {
  pressedOnBackdrop = event.target === event.currentTarget
  releasedOnBackdrop = false
}
function onBackdropPointerUp(event: PointerEvent): void {
  releasedOnBackdrop = event.target === event.currentTarget
}
function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget && pressedOnBackdrop && releasedOnBackdrop) emit('close')
  pressedOnBackdrop = false
  releasedOnBackdrop = false
}

onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  dialog.value?.focus()
})

onUnmounted(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @pointerdown="onBackdropPointerDown" @pointerup="onBackdropPointerUp" @pointercancel="pressedOnBackdrop = false" @click="onBackdropClick">
      <section ref="dialog" class="app-dialog" :class="[`app-dialog--${size}`, `app-dialog--${layout}`, `app-dialog--${tone}`, { 'app-dialog--with-icon': !!slots.icon }]" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <header class="app-dialog__header">
          <div v-if="slots.icon" class="app-dialog__icon" aria-hidden="true"><slot name="icon" /></div>
          <div class="app-dialog__heading"><h2 :id="titleId">{{ title }}</h2><p v-if="description">{{ description }}</p></div>
          <button class="icon-action app-dialog__close" type="button" aria-label="Закрыть" @click="emit('close')"><IconX :size="20" /></button>
        </header>
        <div v-if="slots.default && !hideBody" class="app-dialog__body"><slot /></div>
        <footer v-if="slots.footer" class="app-dialog__footer"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
