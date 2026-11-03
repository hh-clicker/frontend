<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconArrowLeft, IconCheck, IconExternalLink, IconLink, IconSearch } from '@tabler/icons-vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppSelect, { type AppSelectValue } from '../../components/ui/AppSelect.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { applicationContextStore } from '../../services/applicationContext'
import { createSearch, loadSearch, updateSearch } from '../../services/searches'
import type { SearchDefinition } from '../../api/contracts/searches'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import { parseHhSearchUrl, normalizeHhSearchUrl } from '../../utils/hhSearchUrl'
import type { ResumeProfile } from '../../api/contracts/resumes'
import { loadResumes } from '../../services/resumes'

const router = useRouter()
const route = useRoute()
const editingId = computed(() => typeof route.params.searchId === 'string' ? route.params.searchId : null)
const editingSearch = ref<SearchDefinition | null>(null)
const editorLoading = ref(!!editingId.value)
const editorError = ref<string | null>(null)
let editorRequestVersion = 0
const context = applicationContextStore.state
const sourceUrl = ref('')
const name = ref('')
const pagesLimit = ref(5)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const resumes = ref<ResumeProfile[]>([])
const chosenResumeId = ref<AppSelectValue | null>(null)
const resumeOptions = computed(() => resumes.value.map((resume) => ({ value: resume.id, label: resume.name })))
// Matches the backend search validation; notification preferences do not control scanning.
const maxPagesLimit = 20
let resumeRequestVersion = 0

async function refreshResumes(): Promise<void> {
  const version = ++resumeRequestVersion
  const accountId = context.overview?.selectedAccountId
  resumes.value = []
  if (!accountId) return
  try {
    const response = await loadResumes(accountId)
    if (version === resumeRequestVersion) {
      resumes.value = response.items
      if (!resumes.value.some((resume) => resume.id === chosenResumeId.value)) {
        chosenResumeId.value = resumes.value.find((resume) => resume.id === context.overview?.selectedResumeId)?.id ?? null
      }
    }
  } catch {
    if (version === resumeRequestVersion) submitError.value = 'Не удалось загрузить резюме выбранного HH-аккаунта.'
  }
}
watch(() => context.overview?.selectedAccountId, () => { chosenResumeId.value = null; void refreshResumes() })

const parsedUrl = computed(() => parseHhSearchUrl(sourceUrl.value))
const normalizedUrl = computed(() => parsedUrl.value.valid ? normalizeHhSearchUrl(sourceUrl.value) : '')
const parsedResumeId = computed(() => parsedUrl.value.value?.resumeId ?? null)
const matchedResume = computed(() => {
  if (parsedResumeId.value) return resumes.value.find((resume) => resume.hhResumeId === parsedResumeId.value) ?? null
  const localResumeId = editingId.value ? editingSearch.value?.resumeId : chosenResumeId.value
  return resumes.value.find((resume) => resume.id === localResumeId) ?? null
})
const resumeSelection = computed<AppSelectValue | null>({
  get: () => matchedResume.value?.id ?? null,
  set: (value) => {
    if (!parsedResumeId.value && !editingId.value) chosenResumeId.value = value
  },
})
const selectedResumeName = computed(() => {
  const resumeId = parsedResumeId.value
  return matchedResume.value?.name ?? (resumeId ? `Резюме ${shortId(resumeId)}` : editingSearch.value?.resumeName ?? '')
})
const canSubmit = computed(() => parsedUrl.value.valid
  && matchedResume.value !== null
  && (!editingId.value || (editingSearch.value?.id === editingId.value && matchedResume.value?.id === editingSearch.value?.resumeId && editingSearch.value?.status !== 'SCANNING'))
  && !editorLoading.value && !editorError.value
  && name.value.trim().length >= 3
  && name.value.trim().length <= 120
  && Number.isInteger(pagesLimit.value)
  && pagesLimit.value >= 1
  && pagesLimit.value <= maxPagesLimit
  && !submitting.value)

async function submit(): Promise<void> {
  if (!canSubmit.value || !matchedResume.value) return
  submitting.value = true
  submitError.value = null
  const accountId = context.overview?.selectedAccountId
  const searchId = editingId.value
  try {
    const fields = { name: name.value.trim(), sourceUrl: normalizedUrl.value, pagesLimit: pagesLimit.value }
    const created = searchId ? await updateSearch(searchId, fields) : await createSearch({
      ...fields,
      resumeId: matchedResume.value.id,
      resumeName: selectedResumeName.value,
    })
    if (context.overview?.selectedAccountId === accountId) applicationContextStore.selectResume(created.resumeId)
    await applicationContextStore.load(true)
    await router.push({ name: 'searches', query: { created: '1' } })
  } catch (cause) {
    submitError.value = cause instanceof Error ? cause.message : 'Не удалось сохранить поиск'
  } finally {
    submitting.value = false
  }
}

async function loadEditor(): Promise<void> {
  const version = ++editorRequestVersion
  const searchId = editingId.value
  editingSearch.value = null
  editorError.value = null
  submitError.value = null
  name.value = ''; sourceUrl.value = ''; pagesLimit.value = 5
  editorLoading.value = !!searchId
  if (!searchId) return
  try {
    const search = await loadSearch(searchId)
    if (version !== editorRequestVersion) return
    editingSearch.value = search
    name.value = search.name
    sourceUrl.value = search.sourceUrl
    pagesLimit.value = search.pagesLimit
  } catch (cause) {
    if (version === editorRequestVersion) editorError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить поиск'
  } finally {
    if (version === editorRequestVersion) editorLoading.value = false
  }
}
watch(editingId, () => { void loadEditor() }, { immediate: true })

onMounted(async () => {
  await applicationContextStore.load()
  await refreshResumes()
})

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}
</script>

<template>
  <div class="create-search-page">
    <RouterLink class="back-link" to="/searches"><IconArrowLeft :size="18" /> К списку поисков</RouterLink>
    <header class="page-header">
      <div>
        <h1>{{ editingId ? 'Редактирование поиска' : 'Новый поиск' }}</h1>
        <p>{{ editingId ? 'Измените название, ссылку или лимит страниц. Найденные вакансии и очередь сохранятся.' : 'Вставьте ссылку поиска HH. Если в ней нет резюме, выберите его для локальной привязки поиска.' }}</p>
      </div>
    </header>

    <AppAlert v-if="submitError" tone="warning" dismissible @dismiss="submitError = null">
      <strong>Не удалось сохранить поиск.</strong> {{ submitError }}
    </AppAlert>
    <AppAlert v-else-if="context.overview && !context.overview.selectedResumeId" tone="warning">
      <strong>Сначала добавьте резюме.</strong> Перейдите в <RouterLink class="text-link" to="/resumes">раздел резюме</RouterLink> и настройте HH-профиль.
    </AppAlert>

    <PageSkeleton v-if="editorLoading" />
    <AppAlert v-else-if="editorError" tone="warning">{{ editorError }} <button type="button" class="text-action" @click="loadEditor">Повторить</button></AppAlert>
    <AppAlert v-else-if="editingSearch?.status === 'SCANNING'" tone="info">Дождитесь завершения сканирования. <button type="button" class="text-action" @click="loadEditor">Обновить</button></AppAlert>
    <div v-else class="create-search-layout">
      <form class="search-form-card" @submit.prevent="submit">
        <section class="form-section">
          <div class="form-section__heading">
            <span class="form-step">1</span>
            <div><h2>Ссылка поиска HH</h2><p>Скопируйте полный адрес страницы вместе со всеми фильтрами.</p></div>
          </div>
          <label class="form-field">
            <span class="form-label">Ссылка поиска</span>
            <span class="textarea-with-icon">
              <IconLink :size="18" />
              <textarea v-model="sourceUrl" rows="4" placeholder="https://hh.ru/search/vacancy?text=..." />
            </span>
            <small v-if="parsedUrl.error" class="form-error">{{ parsedUrl.error }}</small>
            <small v-else-if="parsedResumeId && !matchedResume" class="form-error">
              Резюме из ссылки не добавлено в выбранный HH-аккаунт.
            </small>
            <small v-else-if="editingSearch && matchedResume?.id !== editingSearch.resumeId" class="form-error">Нельзя менять резюме существующего поиска. Для другого резюме создайте новый поиск.</small>
            <small v-else class="form-help">Сканирование начнётся только после отдельного подтверждения.</small>
          </label>
        </section>

        <section class="form-section">
          <div class="form-section__heading">
            <span class="form-step">2</span>
            <div><h2>Название и ограничения</h2><p>Название видно только внутри HH Clicker.</p></div>
          </div>
          <div class="form-grid">
            <label class="form-field form-field--wide">
              <span class="form-label">Название поиска</span>
              <input v-model="name" class="form-control" type="text" placeholder="Например, Java Backend — Москва" maxlength="120" />
              <small class="form-help">Минимум 3 символа.</small>
            </label>
            <label class="form-field">
              <span class="form-label">Максимум страниц</span>
              <input v-model.number="pagesLimit" class="form-control" type="number" min="1" :max="maxPagesLimit" />
              <small class="form-help">От 1 до {{ maxPagesLimit }} за запуск — глобальное ограничение.</small>
            </label>
            <div class="form-field form-field--wide">
              <span class="form-label">{{ parsedResumeId ? 'Резюме из ссылки' : 'Резюме для откликов' }}</span>
              <AppSelect
                v-model="resumeSelection"
                :options="resumeOptions"
                :placeholder="parsedResumeId ? 'Резюме из ссылки не найдено' : 'Выберите резюме'"
                aria-label="Резюме для откликов"
                :disabled="!!parsedResumeId || !!editingId || !parsedUrl.valid || !resumes.length || submitting"
              />
              <small v-if="parsedResumeId" class="form-help" :title="parsedResumeId">resumeId: {{ shortId(parsedResumeId) }}</small>
              <small class="form-help">{{ editingId ? 'Резюме существующего поиска остаётся прежним.' : parsedResumeId ? 'Резюме определено параметром resume в ссылке. Ручной выбор недоступен.' : 'Поиск, очередь и стоп-лист будут привязаны к этому резюме.' }}</small>
              <small v-if="!parsedResumeId" class="form-help">Это локальная привязка: параметр resume не добавляется в ссылку и не меняет выдачу HH.</small>
            </div>
          </div>
        </section>

        <footer class="search-form-actions">
          <RouterLink to="/searches"><AppButton>Отмена</AppButton></RouterLink>
          <AppButton variant="primary" type="submit" :disabled="!canSubmit" :loading="submitting">
            {{ editingId ? 'Сохранить изменения' : 'Сохранить поиск' }}
          </AppButton>
        </footer>
      </form>

      <aside class="url-preview-card">
        <div class="url-preview-card__heading">
          <span><IconSearch :size="19" /></span>
          <div><h2>Разбор ссылки</h2><p>Проверяем параметры локально</p></div>
        </div>

        <div v-if="parsedUrl.valid && parsedUrl.value" class="url-preview-success">
          <StatusBadge label="Ссылка распознана" tone="green" />
          <dl>
            <div><dt>Резюме в ссылке</dt><dd :title="parsedUrl.value.resumeId ?? undefined">{{ parsedUrl.value.resumeId ? shortId(parsedUrl.value.resumeId) : 'Не задано' }}</dd></div>
            <div><dt>Регион</dt><dd>{{ parsedUrl.value.area ?? 'Не задан' }}</dd></div>
            <div><dt>Полей поиска</dt><dd>{{ parsedUrl.value.searchFields.length }}</dd></div>
            <div><dt>Других фильтров</dt><dd>{{ parsedUrl.value.filtersCount }}</dd></div>
          </dl>
          <div class="url-preview-note"><IconCheck :size="18" /> Фильтры и сортировка сохранятся. 100 вакансий на страницу, начало с первой страницы.</div>
          <HhExternalLink :href="normalizedUrl" class="preview-link">Открыть ссылку на HH <IconExternalLink :size="16" /></HhExternalLink>
        </div>

        <div v-else class="url-preview-placeholder">
          <IconLink :size="30" />
          <strong>Ожидаем ссылку</strong>
          <p>После вставки здесь появятся найденное резюме, регион и параметры фильтрации.</p>
        </div>
      </aside>
    </div>
  </div>
</template>
