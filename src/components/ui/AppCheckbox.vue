<script setup lang="ts">
defineProps<{
  modelValue: boolean
  disabled?: boolean
  label: string
  visibleLabel?: boolean
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function onChange(event: Event): void {
  emit('update:modelValue', (event.currentTarget as HTMLInputElement).checked)
}
</script>

<template>
  <label class="app-checkbox" :class="{ 'app-checkbox--disabled': disabled, 'app-checkbox--with-label': visibleLabel }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="visibleLabel ? undefined : label"
      @change="onChange"
    />
    <span class="app-checkbox__box" aria-hidden="true" />
    <span v-if="visibleLabel" class="app-checkbox__copy"><strong>{{ label }}</strong><small v-if="description">{{ description }}</small></span>
  </label>
</template>
