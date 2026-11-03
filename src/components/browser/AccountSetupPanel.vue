<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { IconBrandChrome, IconCheck, IconExternalLink, IconFileCv, IconRefresh } from '@tabler/icons-vue'
import type { BrowserProfile, DiscoveredResume } from '../../api/contracts/browser'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import AppCheckbox from '../ui/AppCheckbox.vue'
import HhExternalLink from './HhExternalLink.vue'
import { authorizationChecks, discoverResumesViaAgent, ensureBrowserProfile } from '../../services/browser'
import { importResumes, loadResumes } from '../../services/resumes'
import { applicationContextStore } from '../../services/applicationContext'
import { browserAgentStatus } from '../../composables/useBrowserAgentStatus'

const props = defineProps<{ accountId: string; accountName: string; running: boolean; pageBusy: boolean }>()
const emit = defineEmits<{ profile: [profile: BrowserProfile]; open: []; busy: [busy: boolean] }>()
const router = useRouter()
// Компонент пересоздаётся по accountId. Запросы всегда привязаны к этому аккаунту.
const accountId = props.accountId
let alive = true
const initializing = ref(false)
const initialized = ref(false)
const searching = ref(false)
const saving = ref(false)
const importProgress = ref('')
const importedHashes = ref<string[]>([])
const found = ref<DiscoveredResume[] | null>(null)
const selectedHashes = ref<string[]>([])
const error = ref<string | null>(null)
const searchMessage = ref<string | null>(null)
const checking = computed(() => authorizationChecks[accountId]?.checking ?? false)
const ownBusy = computed(() => initializing.value || searching.value || saving.value)
const locked = computed(() => ownBusy.value || props.pageBusy || checking.value)
const phase = computed(() => found.value !== null ? 3 : props.running ? 2 : 1)
const selected = computed(() => (found.value ?? []).filter((item) => selectedHashes.value.includes(item.hhResumeId) && !importedHashes.value.includes(item.hhResumeId)))
const steps = ['Открыть браузер', 'Войти в HH', 'Выбрать резюме']

function isCurrent(): boolean {
  return alive && applicationContextStore.state.overview?.selectedAccountId === accountId
}

watch(ownBusy, (value) => emit('busy', value))
watch(checking, (value) => {
  if (value && !searching.value && !saving.value) {
    found.value = null
    selectedHashes.value = []
    searchMessage.value = null
  }
})

async function initialize(): Promise<void> {
  if (initializing.value) return
  initializing.value = true
  error.value = null
  try {
    const [profile, resumes] = await Promise.all([ensureBrowserProfile(accountId), loadResumes(accountId)])
    if (!isCurrent()) return
    emit('profile', profile)
    importedHashes.value = resumes.items.map((item) => item.hhResumeId)
    initialized.value = true
  } catch (cause) {
    if (isCurrent()) error.value = cause instanceof Error ? cause.message : 'Не удалось подготовить аккаунт'
  } finally {
    initializing.value = false
  }
}

async function discover(): Promise<void> {
  if (locked.value || !props.running || !isCurrent()) return
  searching.value = true
  error.value = null
  searchMessage.value = null
  found.value = null
  selectedHashes.value = []
  try {
    const command = await discoverResumesViaAgent(accountId)
    if (!isCurrent()) return
    if (command.authorization?.status !== 'AUTHORIZED') {
      searchMessage.value = command.authorization?.message ?? 'Вход не подтверждён. Проверьте вкладку HH.'
      return
    }
    if (!command.resumes) throw new Error('Агент не вернул список резюме. Обновите агент и повторите поиск.')
    const existing = await loadResumes(accountId)
    if (!isCurrent()) return
    importedHashes.value = existing.items.map((item) => item.hhResumeId)
    found.value = command.resumes
    const only = command.resumes.length === 1 ? command.resumes[0] : undefined
    if (only && !importedHashes.value.includes(only.hhResumeId)) selectedHashes.value = [only.hhResumeId]
  } catch (cause) {
    if (isCurrent()) error.value = cause instanceof Error ? cause.message : 'Не удалось найти резюме'
  } finally {
    searching.value = false
  }
}

function toggle(hash: string, value: boolean): void {
  selectedHashes.value = value ? [...new Set([...selectedHashes.value, hash])] : selectedHashes.value.filter((item) => item !== hash)
}

async function save(): Promise<void> {
  if (locked.value || !selected.value.length || !isCurrent()) return
  const items = selected.value.map((item) => ({ ...item }))
  saving.value = true
  error.value = null
  try {
    const result = await importResumes(accountId, items, (index, total) => {
      importProgress.value = `Загружаем текст резюме ${index} из ${total}…`
    })
    if (!isCurrent()) return
    importedHashes.value = [...new Set([...importedHashes.value, ...result.items.map((item) => item.hhResumeId)])]
    selectedHashes.value = []
    const first = result.items[0]
    if (first) applicationContextStore.selectResume(first.id)
    await applicationContextStore.load(true)
    if (isCurrent()) await router.push('/resumes')
  } catch (cause) {
    if (isCurrent()) error.value = cause instanceof Error ? cause.message : 'Не удалось добавить резюме'
  } finally {
    saving.value = false
    importProgress.value = ''
  }
}

onMounted(() => void initialize())
onUnmounted(() => { alive = false; emit('busy', false) })
</script>

<template>
  <section class="account-setup content-card">
    <header class="account-setup__header">
      <div><h2>Настройка аккаунта</h2><p>Добавляем резюме в аккаунт <strong>«{{ accountName }}»</strong></p></div>
      <RouterLink v-if="!locked" to="/resumes" class="account-setup__later">Настроить позже</RouterLink>
    </header>

    <ol class="account-setup__steps" aria-label="Этапы настройки">
      <li v-for="(step, index) in steps" :key="step" :class="{ 'is-current': phase === index + 1, 'is-complete': phase > index + 1 }" :aria-current="phase === index + 1 ? 'step' : undefined">
        <span><IconCheck v-if="phase > index + 1" :size="16" aria-hidden="true" /><template v-else>{{ index + 1 }}</template></span>{{ step }}
      </li>
    </ol>

    <div class="account-setup__body">
      <AppAlert v-if="error" tone="warning">{{ error }}</AppAlert>
      <p v-if="initializing" role="status">Готовим браузерный профиль аккаунта…</p>
      <AppButton v-else-if="!initialized" @click="initialize">Повторить подготовку</AppButton>

      <template v-else>
        <template v-if="found === null">
          <h3>{{ running ? 'Войдите в нужный аккаунт HH' : 'Откройте отдельный браузер для этого аккаунта' }}</h3>
          <p>В Chrome откроется страница профиля HH. Войдите привычным способом, затем вернитесь сюда и нажмите «Я вошёл — найти резюме». Пароль и коды вводятся только на сайте HH.</p>
          <p v-if="importedHashes.length" class="account-setup__hint">Уже добавлено резюме: {{ importedHashes.length }}. Повторная загрузка не создаст дубли и не изменит настройки откликов.</p>
          <AppAlert v-if="searchMessage" tone="warning">{{ searchMessage }}</AppAlert>
        </template>

        <template v-else>
          <div class="account-setup__result-heading"><h3>Выберите резюме для добавления</h3><span>Найдено: {{ found.length }}</span></div>
          <p class="account-setup__hint">Добавим название, ссылку и текст выбранных резюме с печатных страниц HH — без HTML, изображений и контактных блоков. Настройки откликов задаются в HH Clicker.</p>
          <p v-if="!found.length" class="account-setup__empty">На странице профиля не найдены карточки резюме. Убедитесь, что вошли в нужный аккаунт. Если резюме ещё нет, создайте его на HH, затем обновите список.</p>
          <div v-else class="account-setup__resumes">
            <div v-for="resume in found" :key="resume.hhResumeId" class="account-setup__resume" :class="{ 'is-selected': selectedHashes.includes(resume.hhResumeId) }">
              <AppCheckbox :model-value="importedHashes.includes(resume.hhResumeId) || selectedHashes.includes(resume.hhResumeId)" :disabled="locked || importedHashes.includes(resume.hhResumeId)" :label="`Добавить ${resume.name}`" @update:model-value="toggle(resume.hhResumeId, $event)" />
              <IconFileCv :size="22" aria-hidden="true" />
              <div><strong>{{ resume.name }}</strong><small>{{ importedHashes.includes(resume.hhResumeId) ? 'Уже добавлено — настройки сохранены' : 'Будет добавлено в выбранный аккаунт' }}</small></div>
              <HhExternalLink v-if="!locked" :href="`https://hh.ru/resume/${resume.hhResumeId}`" class="account-setup__resume-link">На HH <IconExternalLink :size="15" /></HhExternalLink>
            </div>
          </div>
        </template>

        <p v-if="searching" role="status" class="account-setup__hint">Проверяем вход и читаем карточки резюме…</p>
        <p v-else-if="saving" role="status" class="account-setup__hint">{{ importProgress }}</p>
        <p v-else-if="browserAgentStatus === 'OFFLINE'" class="account-setup__hint">Запустите Browser Agent на компьютере, чтобы продолжить.</p>
        <div class="account-setup__actions">
          <AppButton v-if="!running" variant="primary" :disabled="locked || browserAgentStatus !== 'READY'" @click="emit('open')"><IconBrandChrome :size="18" /> Открыть браузер</AppButton>
          <AppButton v-else :variant="found === null ? 'primary' : 'secondary'" :disabled="locked || browserAgentStatus !== 'READY'" :loading="searching" @click="discover"><IconRefresh v-if="!searching" :size="18" /> {{ found === null ? 'Я вошёл — найти резюме' : 'Обновить список' }}</AppButton>
          <AppButton v-if="found?.length" variant="primary" :disabled="locked || !selected.length" :loading="saving" @click="save">Добавить выбранные ({{ selected.length }})</AppButton>
          <RouterLink v-if="found !== null && importedHashes.length && !locked" to="/resumes" class="account-setup__link">К моим резюме</RouterLink>
        </div>
      </template>
    </div>
  </section>
</template>
