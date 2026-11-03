<script setup lang="ts">
import { computed } from 'vue'
import Multiselect from 'vue-multiselect'

export type AppSelectValue = string | number

export interface AppSelectOption {
  value: AppSelectValue
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: AppSelectValue | null
  options: readonly AppSelectOption[]
  placeholder?: string
  searchable?: boolean
  allowEmpty?: boolean
  disabled?: boolean
  ariaLabel?: string
}>(), {
  placeholder: 'Выберите значение',
  searchable: false,
  allowEmpty: false,
  disabled: false,
  ariaLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: AppSelectValue | null]
  change: [value: AppSelectValue | null]
}>()

const normalizedOptions = computed(() => [...props.options])
const selectedOption = computed<AppSelectOption | null>({
  get: () => normalizedOptions.value.find((option) => option.value === props.modelValue) ?? null,
  set: (option) => {
    const value = option?.value ?? null
    emit('update:modelValue', value)
    emit('change', value)
  },
})
</script>

<template>
  <Multiselect
    v-model="selectedOption"
    class="app-select"
    :options="normalizedOptions"
    label="label"
    track-by="value"
    :placeholder="placeholder"
    :searchable="searchable"
    :allow-empty="allowEmpty"
    :disabled="disabled"
    :show-labels="false"
    :close-on-select="true"
    :aria-label="ariaLabel"
  >
    <template #noOptions>Нет доступных вариантов</template>
    <template #noResult>Ничего не найдено</template>
  </Multiselect>
</template>
