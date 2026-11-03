import type { NotificationSettings } from '../api/contracts/settings'

export interface NotificationRun {
  id: string
  accountId: string
  resumeId: string
  resumeName: string
  sequence: number
  mode: 'APPLY' | 'DRY_RUN'
  status: string
  revision: string
  total: number
  succeeded: number
  failed: number
  attentionIds: string[]
}
export interface VacancyRelevanceNotificationRun {
  id: string
  accountId: string
  resumeId: string
  resumeName: string
  status: string
  revision: string
  finalBatch: boolean
  requestedCount: number
  evaluatedCount: number
  missingCount: number
  errorMessage: string | null
}
export interface NotificationState {
  settings: NotificationSettings
  runs: NotificationRun[]
  relevanceRuns: VacancyRelevanceNotificationRun[]
  marketAnalyses?: MarketAnalysisNotificationRun[]
}
export interface MarketAnalysisNotificationRun {
  id: string
  accountId: string
  resumeId: string
  resumeName: string
  status: string
  phase: string
  revision: string
  updatedAt: string
  processed: number
  total: number
  error: string | null
}
export interface NotificationEvent {
  key: string
  title: string
  body: string
  accountId: string
  resumeId: string
  url: string
}
export interface SeenRun { status: string; revision: string; attentionIds: string[] }
export type SeenRuns = Record<string, SeenRun>

export function rememberRuns(state: NotificationState): SeenRuns {
  const entries: Array<[string, SeenRun]> = [
    ...state.runs.map((run): [string, SeenRun] => [`application:${run.id}`, {
      status: run.status, revision: run.revision, attentionIds: [...run.attentionIds],
    }]),
    ...state.relevanceRuns.map((run): [string, SeenRun] => [`relevance:${run.id}`, {
      status: run.status, revision: run.revision, attentionIds: [],
    }]),
    ...(state.marketAnalyses ?? []).map((run): [string, SeenRun] => [`market:${run.id}`, {
      status: run.status, revision: run.revision, attentionIds: [],
    }]),
  ]
  return Object.fromEntries(entries)
}

const pauseReasons: Record<string, string> = {
  PAUSED_CAPTCHA: 'Нужно пройти капчу на HH.',
  PAUSED_AUTH: 'Нужно восстановить вход на HH.',
  PAUSED_ERROR: 'Проверьте браузер и задачи, требующие внимания.',
  PAUSED_LIMIT: 'Достигнут дневной лимит откликов.',
  PAUSED_AI_LIMIT: 'Лимит Codex исчерпан. Выберите повтор генерации или явно разрешите резервное письмо на странице «Отклики».',
}

export function collectNotificationEvents(previous: SeenRuns | null, state: NotificationState): NotificationEvent[] {
  // The first successful snapshot is a baseline, not a replay of historical runs.
  if (!previous) return []
  const result: NotificationEvent[] = []
  for (const run of state.runs) {
    const dryRun = run.mode === 'DRY_RUN'
    const old = previous[`application:${run.id}`]
    const changed = !old || old.status !== run.status || old.revision !== run.revision
    const newAttention = run.attentionIds.filter(id => !old?.attentionIds.includes(id)).length
    const prefix = `${run.resumeName} · ${dryRun ? 'холостой запуск' : 'запуск'} #${run.sequence}. `
    let title = ''
    let body = ''
    if (changed && run.status === 'COMPLETED' && state.settings.notifyRunCompleted) {
      title = dryRun ? 'Загрузка текстов завершена' : 'Запуск завершён'
      body = dryRun
        ? `Обработано ${run.total}: текст загружен для ${run.succeeded}, не удалось загрузить ${run.failed}.`
        : `Обработано ${run.total}: успешно ${run.succeeded}, требуют внимания ${run.attentionIds.length}, ошибок ${run.failed}.`
    } else if (changed && pauseReasons[run.status] && state.settings.notifyRunPaused) {
      title = dryRun ? 'Загрузка текстов приостановлена' : 'Очередь остановлена'
      body = dryRun
        ? `${pauseReasons[run.status]} Не удалось загрузить текст: ${run.failed}.`
        : `${pauseReasons[run.status]} Требуют внимания: ${run.attentionIds.length}.`
    } else if (newAttention && state.settings.notifyAttentionRequired) {
      title = 'Новые задачи внимания'
      body = `Нужно проверить ${newAttention} вакансий. Откройте результаты запуска.`
    }
    if (title) result.push({
      key: `application:${run.id}:${run.status}:${run.revision}:${run.attentionIds.join(',')}`,
      title, body: prefix + body, accountId: run.accountId, resumeId: run.resumeId,
      url: `/applications?runId=${encodeURIComponent(run.id)}`,
    })
  }
  for (const run of state.relevanceRuns) {
    const old = previous[`relevance:${run.id}`]
    const changed = !old || old.status !== run.status || old.revision !== run.revision
    if (!changed || !state.settings.notifyRelevanceCompleted || !['done', 'failed'].includes(run.status)) continue
    if (run.status === 'done' && !run.finalBatch) continue
    const failed = run.status === 'failed'
    result.push({
      key: `relevance:${run.id}:${run.status}:${run.revision}`,
      title: failed ? 'Не удалось оценить вакансии' : 'Оценка вакансий завершена',
      body: failed
        ? `${run.resumeName} · ${run.errorMessage || 'Generation Agent не смог завершить оценку.'}`
        : `${run.resumeName} · Оценено ${run.evaluatedCount} из ${run.requestedCount}. Без оценки: ${run.missingCount}.`,
      accountId: run.accountId,
      resumeId: run.resumeId,
      url: '/vacancies',
    })
  }
  for (const run of state.marketAnalyses ?? []) {
    const old = previous[`market:${run.id}`]
    // Existing analyses get a silent baseline when this event type first appears.
    if (!old || !state.settings.notifyMarketCompleted
      || (old.status === run.status && old.revision === run.revision)
      || !['COMPLETED', 'FAILED'].includes(run.status)) continue
    result.push({
      key: `market:${run.id}:${run.status}:${run.revision}`,
      title: run.status === 'COMPLETED' ? 'Анализ рынка завершён' : 'Не удалось завершить анализ рынка',
      body: run.status === 'COMPLETED'
        ? `${run.resumeName} · Обработано ${run.processed} из ${run.total} вакансий.`
        : `${run.resumeName} · ${run.error || 'Откройте анализ, чтобы посмотреть причину и продолжить.'}`,
      accountId: run.accountId, resumeId: run.resumeId,
      url: '/market-analysis',
    })
  }
  return result
}
