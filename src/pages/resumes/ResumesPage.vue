<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconBan, IconBriefcase, IconCheck, IconExternalLink, IconFileCv, IconRefresh, IconSearch, IconSend, IconUserPlus } from '@tabler/icons-vue'
import type { HhAccount } from '../../api/contracts/accounts'
import type { ResumeAutomationSettings, ResumeProfile } from '../../api/contracts/resumes'
import AccountEditorDialog from '../../components/resumes/AccountEditorDialog.vue'
import AiLetterEditor from '../../components/resumes/AiLetterEditor.vue'
import { defaultAiLetter, aiLetterError, type AiLetterSettings } from '../../services/aiLetters'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import { usePageData } from '../../composables/usePageData'
import { applicationContextStore } from '../../services/applicationContext'
import { loadResumes, saveResumeSettings } from '../../services/resumes'

const context = applicationContextStore.state
const router = useRouter()
const { data, loading, error, refresh } = usePageData(() => loadResumes(applicationContextStore.state.overview?.selectedAccountId))
const selectedId = ref<string | null>(applicationContextStore.state.overview?.selectedResumeId ?? null)
const saving = ref(false)
const actionError = ref<string | null>(null)
const saved = ref(false)
const accountDialogVisible = ref(false)
const form = reactive<ResumeAutomationSettings & { aiLetter: AiLetterSettings }>({ coverLetter: '', dailyLimit: 20, pauseFromSeconds: 30, pauseToSeconds: 90, skipQuestionnaires: true, aiLetter: defaultAiLetter() })

const resumes = computed(() => (data.value?.items ?? []).filter((item) => item.accountId === context.overview?.selectedAccountId))
const accounts = computed(() => context.overview?.accounts ?? [])
const selectedAccount = computed(() => accounts.value.find((account) => account.id === context.overview?.selectedAccountId) ?? accounts.value[0] ?? null)
const selectedResume = computed(() => resumes.value.find((item) => item.id === selectedId.value) ?? resumes.value[0] ?? null)
const validationError = computed(() => {
  if (form.coverLetter.includes('#AI_CHANGE#')) return 'Маркер #AI_CHANGE# допустим только в AI-шаблоне, не в обычном письме.'
  if (form.coverLetter.length > 10000) return 'Обычное письмо — максимум 10 000 символов.'
  const aiError = aiLetterError(form.aiLetter)
  if (aiError) return aiError
  if (form.dailyLimit < 1 || form.dailyLimit > 500) return 'Дневной лимит должен быть от 1 до 500.'
  if (form.pauseFromSeconds < 10) return 'Минимальная пауза должна быть не меньше 10 секунд.'
  if (form.pauseToSeconds < form.pauseFromSeconds) return 'Максимальная пауза должна быть не меньше минимальной.'
  return null
})
const hasChanges = computed(() => {
  const settings = selectedResume.value?.settings
  return !!settings && (JSON.stringify(settings.aiLetter ?? defaultAiLetter()) !== JSON.stringify(form.aiLetter) || settings.coverLetter !== form.coverLetter || settings.dailyLimit !== form.dailyLimit || settings.pauseFromSeconds !== form.pauseFromSeconds || settings.pauseToSeconds !== form.pauseToSeconds || settings.skipQuestionnaires !== form.skipQuestionnaires)
})

watch(resumes, (items) => {
  const contextId = applicationContextStore.state.overview?.selectedResumeId
  if (!items.some((item) => item.id === selectedId.value)) selectedId.value = items.find((item) => item.id === contextId)?.id ?? items[0]?.id ?? null
}, { immediate: true })

watch(() => applicationContextStore.state.overview?.selectedResumeId, (resumeId) => {
  if (resumeId && resumes.value.some((item) => item.id === resumeId)) selectedId.value = resumeId
})
watch(() => applicationContextStore.state.overview?.selectedAccountId, () => void refresh())

watch(() => selectedResume.value?.id, () => {
  const resume = selectedResume.value
  if (resume) Object.assign(form, structuredClone({ ...resume.settings, aiLetter: resume.settings.aiLetter ?? defaultAiLetter() }))
  saved.value = false
  actionError.value = null
}, { immediate: true })

function selectResume(resume: ResumeProfile): void {
  selectedId.value = resume.id
  applicationContextStore.selectResume(resume.id)
}

function replaceResume(updated: ResumeProfile): void {
  if (data.value) data.value = { items: data.value.items.map((item) => item.id === updated.id ? updated : item) }
}

async function save(): Promise<void> {
  if (!selectedResume.value || validationError.value) return
  saving.value = true
  actionError.value = null
  saved.value = false
  try {
    form.coverLetter = form.coverLetter.trim()
    replaceResume(await saveResumeSettings(selectedResume.value.id, { ...form, aiLetter: { ...form.aiLetter } }))
    await applicationContextStore.load(true)
    saved.value = true
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Не удалось сохранить настройки'
  } finally {
    saving.value = false
  }
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetForm(): void {
  if (selectedResume.value) Object.assign(form, structuredClone({ ...selectedResume.value.settings, aiLetter: selectedResume.value.settings.aiLetter ?? defaultAiLetter() }))
}

async function handleAccountCreated(account: HhAccount): Promise<void> {
  accountDialogVisible.value = false
  applicationContextStore.selectAccount(account.id)
  await applicationContextStore.load(true)
  if (context.overview?.selectedAccountId === account.id) await router.push('/browser')
}

function openImport(): void {
  if (selectedAccount.value) void router.push('/browser')
}

</script>

<template>
  <PageSkeleton v-if="(loading && !data) || (context.loading && !context.overview)" />
  <section v-else-if="error && !data" class="page-error"><IconFileCv :size="36" /><h1>Не удалось загрузить резюме</h1><p>{{ error }}</p><AppButton variant="primary" @click="refresh">Повторить</AppButton></section>
  <div v-else class="resumes-page">
    <header class="page-header">
      <div><h1>Резюме</h1><p>Резюме из HH и локальные настройки автоматических откликов.</p></div>
      <div v-if="accounts.length" class="resumes-page-actions">
        <AppButton @click="accountDialogVisible = true"><IconUserPlus :size="18" /> Добавить аккаунт</AppButton>
        <AppButton v-if="selectedAccount" variant="primary" @click="openImport"><IconRefresh :size="18" /> Загрузить из HH</AppButton>
      </div>
    </header>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null"><strong>Операция не выполнена.</strong> {{ actionError }}</AppAlert>
    <AppAlert v-if="saved" tone="info" dismissible @dismiss="saved = false"><strong>Настройки сохранены.</strong> Они будут предложены при следующем запуске откликов.</AppAlert>

    <section v-if="selectedResume" class="resumes-layout">
      <aside class="resume-list-card">
        <header><div><h2>Мои резюме</h2><span>{{ resumes.length }}</span></div><p>Связаны с выбранным HH-аккаунтом.</p></header>
        <div class="resume-list">
          <button v-for="resume in resumes" :key="resume.id" type="button" class="resume-list-item" :class="{ 'resume-list-item--active': resume.id === selectedResume.id }" @click="selectResume(resume)">
            <span class="resume-list-item__icon"><IconFileCv :size="21" /></span>
            <span class="resume-list-item__content"><strong>{{ resume.name }}</strong><small>{{ resume.accountName }}</small></span>
          </button>
        </div>
      </aside>

      <div class="resume-workspace">
        <section class="resume-profile-card">
          <header>
            <div class="resume-profile-card__title"><span><IconFileCv :size="24" /></span><div><h2>{{ selectedResume.name }}</h2></div></div>
            <div class="resume-profile-card__actions"><HhExternalLink class="app-button app-button--secondary app-button--medium" :href="selectedResume.publicUrl">Открыть на HH <IconExternalLink :size="17" /></HhExternalLink></div>
          </header>
          <dl><div><dt>HH Resume ID</dt><dd>{{ selectedResume.hhResumeId }}</dd></div><div><dt>HH-аккаунт</dt><dd>{{ selectedResume.accountName }}</dd></div></dl>
          <details v-if="selectedResume.plainText" class="resume-plain-text" :key="selectedResume.id">
            <summary>Текст резюме с HH</summary>
            <p>Сохранён при добавлении резюме. Изображения и контактные блоки не загружались.</p>
            <pre>{{ selectedResume.plainText }}</pre>
          </details>
        </section>

        <section class="resume-stats">
          <div><span class="resume-stat-icon resume-stat-icon--purple"><IconSearch :size="19" /></span><span>Поисков</span><strong>{{ selectedResume.statistics.searches }}</strong></div>
          <div><span class="resume-stat-icon resume-stat-icon--blue"><IconBriefcase :size="19" /></span><span>Новых вакансий</span><strong>{{ selectedResume.statistics.newVacancies }}</strong></div>
          <div><span class="resume-stat-icon resume-stat-icon--orange"><IconSend :size="19" /></span><span>В очереди</span><strong>{{ selectedResume.statistics.queuedVacancies }}</strong></div>
          <div><span class="resume-stat-icon resume-stat-icon--green"><IconCheck :size="19" /></span><span>Успешных откликов</span><strong>{{ selectedResume.statistics.successfulApplications }}</strong></div>
          <div><span class="resume-stat-icon resume-stat-icon--neutral"><IconBan :size="19" /></span><span>Компаний в стоп-листе</span><strong>{{ selectedResume.statistics.blockedCompanies }}</strong></div>
        </section>

        <section class="resume-settings-card">
          <header><div><h2>Настройки откликов</h2><p>Значения по умолчанию для запусков с этим резюме.</p></div></header>
          <div class="resume-settings-card__body">
            <AiLetterEditor v-model="form.aiLetter" :disabled="saving" />
            <label class="form-field resume-cover-letter"><span class="form-label">Обычное / резервное сопроводительное</span><textarea v-model="form.coverLetter" class="form-control" rows="6" maxlength="10000" placeholder="Письмо не задано" /><small class="form-help">Используется без AI или при ошибке генерации. При включённом AI пустое поле запрещает отклик без сгенерированного письма. При лимите Codex резервное письмо требует подтверждения. Перед запуском текст можно изменить.</small></label>
            <div class="resume-settings-grid">
              <label class="form-field"><span class="form-label">Дневной лимит</span><input v-model.number="form.dailyLimit" class="form-control" type="number" min="1" max="500" /><small class="form-help">От 1 до 500 откликов.</small></label>
              <div class="form-field"><span class="form-label">Случайная пауза</span><div class="resume-pause-fields"><label><span>От</span><input v-model.number="form.pauseFromSeconds" class="form-control" type="number" min="10" /></label><label><span>До</span><input v-model.number="form.pauseToSeconds" class="form-control" type="number" min="10" /></label><span>сек.</span></div></div>
            </div>
            <p class="resume-questionnaire-setting">Вакансии с анкетами передаются на ручное заполнение и не останавливают очередь.</p>
            <p v-if="validationError" class="form-error">{{ validationError }}</p>
          </div>
          <footer><AppButton :disabled="!hasChanges" @click="resetForm">Отменить изменения</AppButton><AppButton variant="primary" :disabled="!hasChanges || !!validationError" :loading="saving" @click="save">Сохранить настройки</AppButton></footer>
        </section>
      </div>
    </section>

    <section v-else class="content-card resumes-empty">
      <EmptyState
        v-if="!accounts.length"
        title="Добавьте HH-аккаунт"
        description="Создайте локальный аккаунт, войдите в HH через браузер и выберите резюме для добавления."
      >
        <AppButton variant="primary" @click="accountDialogVisible = true"><IconUserPlus :size="18" /> Добавить аккаунт</AppButton>
      </EmptyState>
      <EmptyState
        v-else
        title="Добавьте первое резюме"
        :description="`Продолжите настройку аккаунта «${selectedAccount?.name}»: войдите в HH и выберите резюме.`"
      >
        <AppButton variant="primary" @click="openImport"><IconRefresh :size="18" /> Продолжить настройку</AppButton>
      </EmptyState>
    </section>
  </div>

  <AccountEditorDialog
    v-if="accountDialogVisible"
    @close="accountDialogVisible = false"
    @created="handleAccountCreated"
  />
</template>
