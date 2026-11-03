import type { MockScenario } from '../app/runtime'
import type { ApplicationItem, ApplicationOutcome, ApplicationRun } from '../api/contracts/applications'
import type { AttentionTask, AttentionTaskKind } from '../api/contracts/attention'
import { getApplicationRunsMock } from './applications'
import { getVacanciesMock } from './vacancies'

const stateByScenario = new Map<MockScenario, AttentionTask[]>()

export function getAttentionTasksMock(scenario: MockScenario): AttentionTask[] {
  const tasks = stateByScenario.get(scenario) ?? []
  if (!stateByScenario.has(scenario)) stateByScenario.set(scenario, tasks)
  appendOpenTasks(tasks, scenario)
  return tasks
}

function appendOpenTasks(tasks: AttentionTask[], scenario: MockScenario): void {
  if (scenario === 'empty') return
  getApplicationRunsMock(scenario).forEach((run) => run.applications
    .filter((item) => item.status === 'ATTENTION_REQUIRED')
    .forEach((item) => {
      if (tasks.some((task) => task.applicationId === item.id)) return
      tasks.push(toAttentionTask(run, item, scenario))
    }))
}

function toAttentionTask(run: ApplicationRun, item: ApplicationItem, scenario: MockScenario): AttentionTask {
  const vacancy = getVacanciesMock(scenario).find((candidate) => candidate.id === item.vacancyId)
  const outcome = item.outcome ?? 'UNKNOWN'
  return {
    id: item.id,
    kind: kindFor(outcome),
    status: item.attentionStatus ?? 'OPEN',
    title: titleFor(outcome),
    description: item.message ?? 'Результат отклика требует ручной проверки.',
    runId: run.id,
    runSequence: run.sequence,
    applicationId: item.id,
    vacancyId: item.vacancyId,
    hhVacancyId: item.hhVacancyId ?? vacancy?.hhVacancyId,
    vacancyTitle: item.vacancyTitle,
    employerId: vacancy?.company.id,
    companyName: item.companyName,
    resumeName: run.resumeName,
    occurredAt: item.attemptedAt ?? run.createdAt,
    outcome,
    canContinueRun: run.status.startsWith('PAUSED_')
      && run.applications.some((candidate) => candidate.status === 'QUEUED')
      && !run.applications.some((candidate) => candidate.status === 'IN_PROGRESS'),
    canSkipVacancy: outcome !== 'SENT_LETTER_UNCONFIRMED' && outcome !== 'SENT_LETTER_REJECTED_ALREADY_VIEWED',
  }
}

function kindFor(outcome: ApplicationOutcome): AttentionTaskKind {
  if (outcome === 'QUESTIONNAIRE') return 'QUESTIONNAIRE'
  if (outcome === 'CAPTCHA') return 'CAPTCHA'
  if (outcome === 'AUTH') return 'AUTH'
  return 'ERROR'
}

function titleFor(outcome: ApplicationOutcome): string {
  if (outcome === 'QUESTIONNAIRE') return 'Заполнить анкету работодателя'
  if (outcome === 'CAPTCHA') return 'Пройти проверку HH'
  if (outcome === 'AUTH') return 'Войти в аккаунт HH'
  return 'Проверить неподтверждённый отклик'
}
