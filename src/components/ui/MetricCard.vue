<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: number
  hint: string
  tone: 'purple' | 'blue' | 'green' | 'orange'
  icon: Component
}>()
</script>

<template>
  <article class="metric-card">
    <span class="metric-card__label">{{ label }}</span>
    <div class="metric-card__value-row">
      <strong>{{ value }}</strong>
      <span class="metric-card__icon" :class="`metric-card__icon--${tone}`">
        <component :is="icon" :size="22" stroke-width="1.8" />
      </span>
    </div>
    <span class="metric-card__hint">{{ hint }}</span>
  </article>
</template>
