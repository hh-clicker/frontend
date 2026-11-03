<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  IconAlertTriangle,
  IconBan,
  IconBriefcase,
  IconCheck,
  IconClock,
  IconGauge,
  IconListCheck,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
} from '@tabler/icons-vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import MetricCard from '../../components/ui/MetricCard.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { applicationContextStore } from '../../services/applicationContext'
import { formatDateTime } from '../../utils/dateTime'
import type { AttentionKind, OverviewMetric } from '../../api/contracts/overview'
import { setApplicationRunStatus } from '../../services/applications'

const context = applicationContextStore.state
const overview = computed(() => context.overview)

onMounted(() => void applicationContextStore.load(true))
const runError = ref<string | null>(null)
const runBusy = ref(false)
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => { poll = setInterval(() => { if (!context.loading) void applicationContextStore.load(true) }, 5000) })
onUnmounted(() => clearInterval(poll))

const metricIcons: Record<OverviewMetric['id'], typeof IconBriefcase> = {
  new: IconBriefcase,
  selected: IconListCheck,
  succeeded: IconCheck,
  attention: IconAlertTriangle,
  limit: IconGauge,
}

const attentionLabels: Record<AttentionKind, string> = {
  QUESTIONNAIRE: 'Анкета',
  CAPTCHA: 'CAPTCHA',
  AUTH: 'Авторизация',
  ERROR: 'Ошибка',
}

const attentionTones: Record<AttentionKind, 'orange' | 'red'> = {
  QUESTIONNAIRE: 'orange',
  CAPTCHA: 'orange',
  AUTH: 'orange',
  ERROR: 'red',
}

const runProgress = computed(() => {
  const run = overview.value?.activeRun
  return run ? Math.round((run.processed / run.total) * 100) : 0
})
const selectedCount = computed(() => overview.value?.metrics.find((metric) => metric.id === 'selected')?.value ?? 0)
async function toggleActiveRun(): Promise<void> {
  const run = overview.value?.activeRun
  if (!run || runBusy.value) return
  runBusy.value = true
  runError.value = null
  try {
    await setApplicationRunStatus(run.id, run.status === 'RUNNING' ? 'PAUSED_USER' : 'RUNNING')
    await applicationContextStore.load(true)
  } catch (cause) { runError.value = cause instanceof Error ? cause.message : 'Не удалось изменить запуск' }
  finally { runBusy.value = false }
}
</script>

<template>
  <PageSkeleton v-if="context.loading && !overview" />

  <section v-else-if="context.error && !overview" class="page-error">
    <IconAlertTriangle :size="34" />
    <h1>Не удалось загрузить обзор</h1>
    <p>{{ context.error }}</p>
    <AppButton variant="primary" @click="applicationContextStore.load(true)">Повторить</AppButton>
  </section>

  <div v-else-if="overview" class="overview-page">
    <AppAlert v-if="runError" tone="warning">{{ runError }}</AppAlert>
    <header class="page-header">
      <div>
        <h1>Обзор</h1>
        <p>Состояние поисков, откликов и задач, которые требуют вашего решения.</p>
      </div>
      <RouterLink v-if="overview.accounts.length" to="/searches/new"><AppButton variant="primary"><IconPlus :size="18" /> Добавить поиск</AppButton></RouterLink>
      <RouterLink v-else to="/resumes"><AppButton variant="primary"><IconPlus :size="18" /> Настроить HH-профиль</AppButton></RouterLink>
    </header>

    <AppAlert v-if="!overview.accounts.length" tone="info">
      <strong>Начните с HH-профиля.</strong> Добавьте локальный аккаунт и резюме — после этого можно будет сохранять поиски вакансий.
    </AppAlert>

    <section class="metric-grid" aria-label="Сводные показатели">
      <MetricCard
        v-for="metric in overview.metrics"
        :key="metric.id"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
        :tone="metric.tone"
        :icon="metricIcons[metric.id]"
      />
    </section>

    <section v-if="overview.activeRun" class="run-card">
      <div class="run-card__header">
        <div>
          <span class="section-kicker">Активный запуск</span>
          <h2>Запуск #{{ overview.activeRun.sequence }}</h2>
        </div>
        <StatusBadge :label="overview.activeRun.status === 'RUNNING' ? 'Работает' : overview.activeRun.status === 'PAUSED_LIMIT' ? 'Дневной лимит' : overview.activeRun.status === 'PAUSED_AI_LIMIT' ? 'Лимит Codex' : 'На паузе'" :tone="overview.activeRun.status === 'RUNNING' ? 'green' : 'blue'" />
      </div>
      <div class="run-card__progress-row">
        <div>
          <strong>{{ overview.activeRun.processed }} из {{ overview.activeRun.total }}</strong>
          <span>вакансий обработано</span>
        </div>
        <div class="run-progress" role="progressbar" :aria-valuenow="runProgress" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ width: `${runProgress}%` }" />
        </div>
        <strong class="run-card__percent">{{ runProgress }}%</strong>
      </div>
      <div class="run-card__footer">
        <div class="run-stats">
          <span><i class="run-stat-dot run-stat-dot--success" />Успешно: {{ overview.activeRun.succeeded }}</span>
          <span><i class="run-stat-dot run-stat-dot--warning" />Внимание: {{ overview.activeRun.attention }}</span>
          <span><i class="run-stat-dot run-stat-dot--danger" />Ошибки: {{ overview.activeRun.failed }}</span>
        </div>
        <AppButton size="small" @click="toggleActiveRun"><IconPlayerPause v-if="overview.activeRun.status === 'RUNNING'" :size="17" /><IconPlayerPlay v-else :size="17" /> {{ overview.activeRun.status === 'RUNNING' ? 'Поставить на паузу' : 'Продолжить' }}</AppButton>
      </div>
    </section>

    <div class="overview-columns">
      <section class="content-card">
        <header class="content-card__header">
          <div>
            <h2>Последние поиски</h2>
            <p>Сохранённые поиски по выбранному резюме</p>
          </div>
          <RouterLink class="text-link" to="/searches">Смотреть все</RouterLink>
        </header>

        <div v-if="overview.recentSearches.length" class="search-list">
          <article v-for="search in overview.recentSearches" :key="search.id" class="search-row">
            <span class="search-row__icon"><IconBriefcase :size="19" /></span>
            <div class="search-row__main">
              <strong>{{ search.name }}</strong>
              <span>Создан: {{ formatDateTime(search.createdAt) }}</span>
            </div>
            <StatusBadge :label="search.status === 'ACTIVE' ? 'Активен' : 'Пауза'" :tone="search.status === 'ACTIVE' ? 'green' : 'blue'" />
            <div class="search-row__count"><strong>{{ search.newVacancies }}</strong><span>новых</span></div>
          </article>
        </div>
        <EmptyState v-else title="Сохранённых поисков пока нет" description="Добавьте ссылку поиска HH, чтобы получить первые вакансии.">
          <RouterLink :to="overview.selectedResumeId ? '/searches/new' : '/resumes'"><AppButton variant="primary" size="small">{{ overview.selectedResumeId ? 'Добавить поиск' : 'Добавить резюме' }}</AppButton></RouterLink>
        </EmptyState>
      </section>

      <section class="content-card">
        <header class="content-card__header">
          <div>
            <h2>Требуют внимания</h2>
            <p>Анкеты, проверки и нештатные ситуации</p>
          </div>
          <RouterLink class="text-link" to="/applications">К откликам</RouterLink>
        </header>

        <div v-if="overview.attentionItems.length" class="attention-list">
          <article v-for="item in overview.attentionItems" :key="item.id" class="attention-row">
            <span class="attention-row__icon"><IconAlertTriangle :size="19" /></span>
            <div class="attention-row__main">
              <strong>{{ item.vacancy }}</strong>
              <span>{{ item.company }} · {{ item.occurredAt }}</span>
            </div>
            <StatusBadge :label="attentionLabels[item.kind]" :tone="attentionTones[item.kind]" />
          </article>
        </div>
        <EmptyState v-else title="Всё спокойно" description="Нет откликов, которые требуют ручного действия." />
      </section>
    </div>

    <section class="quick-actions">
      <RouterLink class="quick-action" to="/vacancies"><IconListCheck :size="20" /><span><strong>Разобрать вакансии</strong><small>{{ selectedCount }} выбраны к отклику</small></span></RouterLink>
      <RouterLink class="quick-action" to="/bans"><IconBan :size="20" /><span><strong>Открыть стоп-лист</strong><small>Проверить заблокированные компании</small></span></RouterLink>
      <RouterLink class="quick-action" to="/applications"><IconClock :size="20" /><span><strong>История откликов</strong><small>Результаты предыдущих запусков</small></span></RouterLink>
    </section>
  </div>
</template>
