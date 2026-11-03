<script setup lang="ts">
import { ref, watch } from 'vue'
import type { VacancyText } from '../../api/contracts/vacancies'
import { loadVacancyText } from '../../services/vacancies'

const props = defineProps<{ vacancyId: string }>()
const snapshot = ref<VacancyText | null>(null)
const loading = ref(false)
const failed = ref(false)
const retry = ref(0)

watch(() => [props.vacancyId, retry.value] as const, async ([id], _, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  snapshot.value = null
  failed.value = false
  loading.value = true
  try {
    const result = await loadVacancyText(id)
    if (!cancelled) snapshot.value = result
  } catch {
    if (!cancelled) failed.value = true
  } finally {
    if (!cancelled) loading.value = false
  }
}, { immediate: true })

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}
</script>

<template>
  <section class="vacancy-description-snapshot" aria-label="Текст вакансии с HH">
    <h3>Текст вакансии с HH</h3>
    <p v-if="loading" role="status">Загружаем сохранённое описание…</p>
    <p v-else-if="failed" role="alert">Не удалось загрузить сохранённый текст. <button type="button" @click="retry++">Повторить</button></p>
    <template v-else-if="snapshot">
      <p v-if="snapshot.plainText === null">Текст пока не сохранён. Он загружается при открытии вакансии кликером перед откликом.</p>
      <template v-else>
        <p v-if="snapshot.textLoadedAt">Сохранено {{ formatDate(snapshot.textLoadedAt) }} · Только текст, без изображений.</p>
        <pre v-if="snapshot.plainText">{{ snapshot.plainText }}</pre>
        <p v-else>В блоке описания нет текстового содержимого. Изображения не распознаём.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.vacancy-description-snapshot { margin-top: 20px; border-top: 1px solid var(--color-border); padding-top: 16px; }
h3 { margin: 0 0 8px; font-size: 14px; }
p { margin: 8px 0; font-size: 12px; color: var(--color-muted); }
pre { margin: 12px 0 0; max-height: 420px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.6; }
button { border: 0; padding: 0; background: none; color: var(--color-primary); cursor: pointer; font: inherit; }
</style>
