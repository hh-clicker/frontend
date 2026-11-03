<script setup lang="ts">
import { computed } from 'vue'
import Multiselect from 'vue-multiselect'
import type { AppSelectOption, AppSelectValue } from './AppSelect.vue'

const props = withDefaults(defineProps<{
  modelValue: AppSelectValue[]
  options: readonly AppSelectOption[]
  placeholder?: string
  ariaLabel?: string
}>(), {
  placeholder: 'Все',
  ariaLabel: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: AppSelectValue[]] }>()
const normalizedOptions = computed(() => [...props.options])
const selectedOptions = computed<AppSelectOption[]>({
  get: () => normalizedOptions.value.filter((option) => props.modelValue.includes(option.value)),
  set: (options) => emit('update:modelValue', options.map((option) => option.value)),
})
</script>

<template>
  <Multiselect
    v-model="selectedOptions"
    class="app-select app-select--multiple"
    :options="normalizedOptions"
    label="label"
    track-by="value"
    :placeholder="placeholder"
    :multiple="true"
    :searchable="false"
    :close-on-select="false"
    :clear-on-select="false"
    :show-labels="false"
    :aria-label="ariaLabel"
  >
    <template #selection="{ values }">
      <span v-if="values.length" class="multiselect__single">
        {{ values.length === 1 ? values[0].label : `Выбрано: ${values.length}` }}
      </span>
    </template>
    <template #noOptions>Нет доступных вариантов</template>
  </Multiselect>
</template>
