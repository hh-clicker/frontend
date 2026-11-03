<script setup lang="ts">
import type { VacancyEnrichmentPreviewData } from './vacancyEnrichmentPreview'

defineProps<{ data: VacancyEnrichmentPreviewData }>()
</script>

<template>
  <section class="vacancy-enrichment-preview" aria-label="Расширенные сведения о вакансии">
    <div class="vacancy-enrichment-section">
      <h3>Условия</h3>
      <dl><div v-for="item in data.conditions" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    </div>
    <div class="vacancy-enrichment-section">
      <h3>Отклик</h3>
      <dl><div v-for="item in data.application" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    </div>
    <div class="vacancy-enrichment-section">
      <h3>Требования</h3>
      <dl><div v-for="item in data.requirements" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    </div>
    <div class="vacancy-enrichment-section">
      <h3>Компания</h3>
      <dl><div v-for="item in data.company" :key="item.label"><dt>{{ item.label }}</dt><dd><a v-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.value }}</a><template v-else>{{ item.value }}</template></dd></div></dl>
    </div>
    <div class="vacancy-enrichment-section">
      <h3>Место работы</h3>
      <dl><div v-for="item in data.location" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    </div>
    <div class="vacancy-enrichment-section">
      <h3>Даты HH</h3>
      <dl><div v-for="item in data.dates" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    </div>
  </section>
</template>
