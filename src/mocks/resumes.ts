import type { MockScenario } from '../app/runtime'
import type { ImportResumeItem, ResumeAutomationSettings, ResumeProfile, ResumesResponse } from '../api/contracts/resumes'
import { registerMockResume, touchMockState } from './state'
import { getAccountsMock } from './accounts'
import { getSearchesMock } from './searches'
import { getVacanciesMock } from './vacancies'
import { getApplicationRunsMock } from './applications'
import { getCompanyBansMock } from './bans'

const initialResumes: ResumeProfile[] = [
  {
    id: 'resume-marketing', hhResumeId: '11111111111111111111111111111111111111', name: 'Маркетолог 2024',
    accountId: 'account-1', accountName: 'Аккаунт #1',
    publicUrl: 'https://hh.ru/resume/11111111111111111111111111111111111111',
    settings: { coverLetter: 'Здравствуйте! Меня заинтересовала ваша вакансия. Буду рад обсудить свой опыт и задачи команды.', dailyLimit: 20, pauseFromSeconds: 30, pauseToSeconds: 90, skipQuestionnaires: true },
    statistics: { searches: 3, newVacancies: 128, queuedVacancies: 10, successfulApplications: 46, blockedCompanies: 4 },
  },
  {
    id: 'resume-java', hhResumeId: '4a245a95285b42bc97ef2185cff16d3c', name: 'Java-разработчик',
    accountId: 'account-2', accountName: 'Рабочий HH',
    publicUrl: 'https://hh.ru/resume/4a245a95285b42bc97ef2185cff16d3c',
    settings: { coverLetter: 'Здравствуйте! Готов подробнее рассказать о своём опыте backend-разработки и выполненных проектах.', dailyLimit: 15, pauseFromSeconds: 45, pauseToSeconds: 120, skipQuestionnaires: true },
    statistics: { searches: 2, newVacancies: 64, queuedVacancies: 4, successfulApplications: 19, blockedCompanies: 2 },
  },
]

const stateByScenario = new Map<MockScenario, ResumeProfile[]>()

export function getResumesMock(scenario: MockScenario): ResumesResponse {
  let items = stateByScenario.get(scenario)
  if (!items) {
    items = scenario === 'empty' ? [] : structuredClone(scenario === 'partial' ? initialResumes.slice(0, 1) : initialResumes)
    stateByScenario.set(scenario, items)
  }
  items.forEach((resume) => syncStatistics(scenario, resume))
  return { items }
}

function syncStatistics(scenario: MockScenario, resume: ResumeProfile): void {
  const searches = getSearchesMock(scenario).filter((search) => search.resumeId === resume.id)
  const vacancies = getVacanciesMock(scenario).filter((vacancy) => vacancy.resumeId === resume.id)
  const applications = getApplicationRunsMock(scenario).filter((run) => run.resumeId === resume.id).flatMap((run) => run.applications)
  const bans = getCompanyBansMock(scenario).filter((ban) => ban.scope === 'GLOBAL' || ban.resumeId === resume.id)
  resume.statistics = {
    searches: searches.length, newVacancies: vacancies.filter((vacancy) => vacancy.status === 'NEW').length,
    queuedVacancies: vacancies.filter((vacancy) => vacancy.queuedForApplication).length,
    successfulApplications: applications.filter((application) => application.status === 'SUCCEEDED').length,
    blockedCompanies: bans.length,
  }
}

export function updateResumeSettingsMock(scenario: MockScenario, resumeId: string, settings: ResumeAutomationSettings): ResumeProfile {
  const resume = getResumesMock(scenario).items.find((item) => item.id === resumeId)
  if (!resume) throw new Error('Резюме не найдено')
  resume.settings = structuredClone(settings)
  touchMockState()
  return resume
}

export function importResumeMock(scenario: MockScenario, accountId: string, request: ImportResumeItem): ResumeProfile {
  const items = getResumesMock(scenario).items
  if (items.some((item) => item.hhResumeId === request.hhResumeId)) throw new Error('Это резюме HH уже добавлено')
  const accountName = getAccountsMock(scenario).find((account) => account.id === accountId)?.name
  if (!accountName) throw new Error('HH-аккаунт не найден')
  const resume: ResumeProfile = {
    id: `resume-${crypto.randomUUID()}`,
    hhResumeId: request.hhResumeId,
    name: request.name.trim(),
    plainText: request.plainText,
    textLoadedAt: new Date().toISOString(),
    accountId,
    accountName,
    publicUrl: `https://hh.ru/resume/${request.hhResumeId}`,
    settings: { coverLetter: '', dailyLimit: 20, pauseFromSeconds: 30, pauseToSeconds: 90, skipQuestionnaires: true },
    statistics: { searches: 0, newVacancies: 0, queuedVacancies: 0, successfulApplications: 0, blockedCompanies: 0 },
  }
  items.push(resume)
  registerMockResume(accountId, resume.id)
  touchMockState()
  return resume
}
