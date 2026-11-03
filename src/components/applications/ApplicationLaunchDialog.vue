<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconAlertTriangle, IconPlayerPlay } from '@tabler/icons-vue'
import type { ApplicationRunSettings } from '../../api/contracts/applications'
import type { ResumeAutomationSettings } from '../../api/contracts/resumes'
import AppButton from '../ui/AppButton.vue'
import AppDialog from '../ui/AppDialog.vue'
import AppCheckbox from '../ui/AppCheckbox.vue'
import AiLetterEditor from '../resumes/AiLetterEditor.vue'
import { defaultAiLetter, aiLetterError } from '../../services/aiLetters'

const props = defineProps<{
  vacancyCount: number
  questionnaireCount: number
  unconfirmedCount?: number
  dailyLimitRemaining: number
  defaults?: ResumeAutomationSettings | null
  submitting?: boolean
  resumeName?: string
}>()
const emit = defineEmits<{ close: []; submit: [settings: ApplicationRunSettings] }>()

const dailyLimit = ref(Math.min(props.vacancyCount, props.defaults?.dailyLimit ?? 20, props.dailyLimitRemaining))
const dryRun = ref(false)
const dryRunLimit = ref(Math.min(props.vacancyCount, 500))
const pauseFromSeconds = ref(props.defaults?.pauseFromSeconds ?? 30)
const pauseToSeconds = ref(props.defaults?.pauseToSeconds ?? 90)
const coverLetter = ref(props.defaults?.coverLetter ?? '')
const aiLetter = ref({ ...(props.defaults?.aiLetter ?? defaultAiLetter()) })
const validationError = computed(() => {
  if (dryRun.value) {
    if (!Number.isInteger(dryRunLimit.value) || dryRunLimit.value < 1 || dryRunLimit.value > Math.min(props.vacancyCount, 500))
      return `Укажите количество вакансий от 1 до ${Math.min(props.vacancyCount, 500)}.`
    if (![pauseFromSeconds.value, pauseToSeconds.value].every(Number.isInteger)) return 'Укажите целые значения паузы.'
    if (pauseFromSeconds.value < 10) return 'Минимальная пауза должна быть не меньше 10 секунд.'
    if (pauseToSeconds.value < pauseFromSeconds.value) return 'Максимальная пауза должна быть больше минимальной.'
    if (pauseToSeconds.value > 3600) return 'Максимальная пауза — 3600 секунд.'
    return null
  }
  if (coverLetter.value.includes('#AI_CHANGE#')) return 'Маркер #AI_CHANGE# допустим только в AI-шаблоне.'
  const aiError = aiLetterError(aiLetter.value)
  if (aiError) return aiError
  if (![dailyLimit.value, pauseFromSeconds.value, pauseToSeconds.value].every(Number.isInteger)) return 'Укажите целые числа.'
  if (dailyLimit.value > 500 || pauseToSeconds.value > 3600) return 'Максимум — 500 откликов и пауза 3600 секунд.'
  if (coverLetter.value.length > 10000) return 'Письмо не должно превышать 10 000 символов.'
  if (dailyLimit.value < 1) return 'Лимит должен быть не меньше 1.'
  if (dailyLimit.value > props.vacancyCount) return 'Лимит не может превышать размер очереди.'
  if (dailyLimit.value > props.dailyLimitRemaining) return 'Лимит превышает доступный остаток на сегодня.'
  if (pauseFromSeconds.value < 10) return 'Минимальная пауза должна быть не меньше 10 секунд.'
  if (pauseToSeconds.value < pauseFromSeconds.value) return 'Максимальная пауза должна быть больше минимальной.'
  return null
})

function submit(): void {
  if (validationError.value || props.submitting) return
  if (dryRun.value) {
    emit('submit', {
      mode: 'DRY_RUN', dailyLimit: dryRunLimit.value,
      pauseFromSeconds: pauseFromSeconds.value, pauseToSeconds: pauseToSeconds.value,
      coverLetter: '', skipQuestionnaires: false,
    })
    return
  }
  emit('submit', {
    mode: 'APPLY',
    dailyLimit: dailyLimit.value,
    pauseFromSeconds: pauseFromSeconds.value,
    pauseToSeconds: pauseToSeconds.value,
    coverLetter: coverLetter.value.trim(),
    skipQuestionnaires: true,
    aiLetter: { ...aiLetter.value },
  })
}

</script>

<template>
  <AppDialog :title="dryRun ? 'Холостой запуск' : 'Запустить реальные отклики'" :description="dryRun ? 'Агент откроет выбранные вакансии и сохранит их тексты. Отклики и письма отправляться не будут.' : 'Нажатие «Запустить» разрешает отправку выбранных вакансий работодателям.'" size="large" @close="!submitting && $emit('close')">
    <div class="launch-dialog__content">
          <p>Резюме: <strong>{{ resumeName }}</strong>. {{ dryRun ? 'Будут обработаны вакансии из очереди; их статусы и сама очередь не изменятся.' : 'Для первой проверки выберите одну вакансию. Во время работы не меняйте страницу в рабочей вкладке агента.' }}</p>
          <AppCheckbox v-model="dryRun" class="launch-dialog__checkbox" :disabled="submitting" visible-label label="Холостой запуск — только загрузить тексты вакансий" description="Без генерации писем и отправки откликов. Вакансии останутся в очереди." />
          <div class="launch-dialog__summary" :class="{ 'launch-dialog__summary--dry-run': dryRun }">
            <div><span>В очереди</span><strong>{{ vacancyCount }}</strong></div>
            <div v-if="!dryRun"><span>Остаток на сегодня</span><strong>{{ dailyLimitRemaining }}</strong></div>
            <div v-if="!dryRun"><span>С анкетой</span><strong>{{ questionnaireCount }}</strong></div>
          </div>
          <div v-if="!dryRun && unconfirmedCount" class="launch-dialog__warning"><IconAlertTriangle :size="18" /><span>В очереди есть неподтверждённые попытки: {{ unconfirmedCount }}. Сначала проверим их на HH: уже отправленные отклики подтвердим без повтора, остальные обработаем по обычному сценарию.</span></div>

          <div class="launch-dialog__grid">
            <label class="form-field"><span class="form-label">{{ dryRun ? 'Максимум вакансий' : 'Максимум откликов' }}</span><input v-if="dryRun" v-model.number="dryRunLimit" class="form-control" type="number" min="1" :max="Math.min(vacancyCount, 500)" /><input v-else v-model.number="dailyLimit" class="form-control" type="number" min="1" :max="Math.min(vacancyCount, dailyLimitRemaining)" /></label>
            <div class="launch-dialog__pause">
              <span class="form-label">Случайная пауза между {{ dryRun ? 'вакансиями' : 'откликами' }}</span>
              <div><label><span>От</span><input v-model.number="pauseFromSeconds" class="form-control" type="number" min="10" /></label><label><span>До</span><input v-model.number="pauseToSeconds" class="form-control" type="number" min="10" /></label><span>сек.</span></div>
            </div>
          </div>

          <template v-if="!dryRun">
            <AiLetterEditor v-model="aiLetter" :disabled="submitting" />
            <label class="form-field"><span class="form-label">Обычное / резервное письмо</span><textarea v-model="coverLetter" class="form-control launch-dialog__letter" rows="5" maxlength="10000" placeholder="Письмо не задано" /><small>При включённом AI пустое поле запрещает отклик без сгенерированного письма. Непустое письмо используется при ошибке генерации, кроме лимита Codex — там нужно подтверждение. Настройки фиксируются для этого запуска.</small></label>
            <p>Анкеты и другие проблемы отдельных вакансий будут отмечены прямо в истории откликов и не остановят очередь. Капча, потеря доступа и три технических сбоя подряд приостановят запуск.</p>
          </template>
          <p v-else class="launch-dialog__hint">Дневной лимит откликов не расходуется. Агент открывает вакансии по очереди с указанной паузой и сохраняет доступный текст.</p>
          <p v-if="validationError" class="launch-dialog__error">{{ validationError }}</p>
    </div>
    <template #footer><AppButton :disabled="submitting" @click="$emit('close')">Отмена</AppButton><AppButton variant="primary" :loading="submitting" :disabled="!!validationError" @click="submit"><IconPlayerPlay :size="18" /> {{ dryRun ? 'Загрузить тексты' : 'Запустить' }} · {{ dryRun ? dryRunLimit : dailyLimit }}</AppButton></template>
  </AppDialog>
</template>
