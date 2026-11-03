<script setup lang="ts">
import { computed } from 'vue'
import { AI_MARKER, type AiLetterSettings } from '../../services/aiLetters'
import GenerationAgentStatus from './GenerationAgentStatus.vue'
import AppCheckbox from '../ui/AppCheckbox.vue'
const model = defineModel<AiLetterSettings>({ required: true })
defineProps<{ disabled?: boolean }>()
const preview = computed(() => model.value.template.split(AI_MARKER).join('[Здесь будет текст про подходящий опыт для конкретной вакансии]'))
</script>

<template>
  <section class="ai-letter-editor">
    <AppCheckbox v-model="model.enabled" :disabled="disabled" visible-label label="Генерировать сопроводительное для каждой вакансии" />
    <p>AI напишет только середину письма по тексту резюме и вакансии. Приветствие и завершение останутся вашими.</p>
    <GenerationAgentStatus />
    <div v-if="model.enabled" class="ai-letter-editor__fields">
      <label class="form-field"><span class="form-label">Шаблон AI-письма</span><textarea v-model="model.template" class="form-control" rows="6" maxlength="5000" :disabled="disabled" /><small>Один маркер #AI_CHANGE# — место для сгенерированной части. Это отдельный шаблон, не резервное письмо.</small></label>
      <label class="form-field"><span class="form-label">Максимальная длина готового письма</span><input v-model.number="model.maxLength" class="form-control" type="number" min="200" max="5000" :disabled="disabled" /><small>Включая приветствие и завершение; для генерации должно оставаться не менее 200 символов.</small></label>
      <details><summary>Структура готового письма</summary><pre>{{ preview }}</pre></details>
      <p>При обычной ошибке AI используем непустое резервное письмо ниже. Если резерв пустой — без сгенерированного письма отклик не отправляется. При лимите Codex очередь приостанавливается, а резерв требует отдельного подтверждения. Готовый текст отправляется автоматически после запуска очереди.</p>
      <small>Тексты резюме и вакансии будут переданы в Codex через локальный сервис генерации.</small>
    </div>
  </section>
</template>

<style scoped>
.ai-letter-editor { border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 18px; margin-bottom: 20px; min-width: 0; }
.ai-letter-editor p, .ai-letter-editor small { font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.ai-letter-editor p { margin: 10px 0 0; }
.ai-letter-editor__fields { display: grid; gap: 16px; margin-top: 18px; }
.ai-letter-editor textarea { width: 100%; resize: vertical; }
.ai-letter-editor input[type=number] { max-width: 180px; }
.ai-letter-editor pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; margin-bottom: 0; }
.ai-letter-editor summary { cursor: pointer; }
</style>
