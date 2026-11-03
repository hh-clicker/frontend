<script setup lang="ts">
import type { ApplicationItem } from '../../api/contracts/applications'
defineProps<{ item: ApplicationItem }>()
const sources = { GENERATED: 'AI-письмо', FALLBACK: 'Резервное письмо', STATIC: 'Обычное письмо', AI_FAILED: 'AI-письмо не подготовлено' }
const reasons: Record<string, string> = {
  RESUME_TEXT_MISSING: 'Нет сохранённого текста резюме.', VACANCY_TEXT_MISSING: 'В описании вакансии нет доступного текста.',
  SERVICE_UNAVAILABLE: 'Сервис генерации недоступен или не ответил.', TIMEOUT: 'Истекло время ожидания генерации.',
  AUTH_REQUIRED: 'Нужна авторизация Codex.', RATE_LIMIT: 'Сервис ограничил генерацию.',
  INVALID_OUTPUT: 'Результат генерации не подходит для отправки.', EMPTY_LETTER: 'Не удалось составить содержательный текст.',
  INVALID_TEMPLATE: 'Некорректный шаблон или лимит.',
}
</script>
<template>
  <details v-if="item.letter" class="prepared-letter">
    <summary>{{ sources[item.letter.source] }} · {{ item.vacancyTitle }}</summary>
    <p v-if="item.letter.errorCode">{{ reasons[item.letter.errorCode] ?? 'Генерация не завершилась успешно.' }} {{ item.letter.source === 'AI_FAILED' ? 'Резервное письмо не задано — отклик не отправлялся.' : 'Подготовлено резервное письмо.' }} <small>Код: {{ item.letter.errorCode }}</small></p>
    <pre v-if="item.letter.text">{{ item.letter.text }}</pre><p v-else>Письмо пустое.</p>
    <small v-if="item.letter.source !== 'AI_FAILED'">Текст подготовлен перед откликом. Факт отправки смотрите в результате обработки вакансии.</small>
  </details>
</template>
<style scoped>
.prepared-letter { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-subtle); }
summary { cursor: pointer; overflow-wrap: anywhere; }
pre { font: inherit; font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
p, small { font-size: 13px; line-height: 1.5; }
</style>
