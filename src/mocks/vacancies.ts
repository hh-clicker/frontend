import type { MockScenario } from '../app/runtime'
import type { Vacancy, VacancyEnrichment, VacancyRelevance } from '../api/contracts/vacancies'

export const MOCK_SAVED_VACANCY_TEXT = 'Задачи:\n- Разрабатывать и поддерживать сервисы.\n- Участвовать в обсуждении решений и code review.\n\nУсловия:\nУдалённая работа в команде.'

const baseVacancies: Vacancy[] = [
  {
    id: 'vacancy-101', resumeId: 'resume-marketing', hhVacancyId: '101', searchId: 'search-python', title: 'Python-разработчик (Middle)',
    company: { id: '3529', name: 'ТехноСофт' },
    salary: { from: 150000, to: 200000, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Удалённо', experience: '3–6 лет', publishedAt: '2026-08-31T10:24:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'NEW', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
  },
  {
    id: 'vacancy-102', resumeId: 'resume-marketing', hhVacancyId: '102', searchId: 'search-python', title: 'Backend Developer (Django)',
    company: { id: '9147', name: 'DataBridge' },
    salary: { from: 180000, to: 230000, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Гибрид', experience: '1–3 года', publishedAt: '2026-08-31T09:41:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'NEW', queuedForApplication: true, banScope: null, hasQuestionnaire: true,
  },
  {
    id: 'vacancy-103', resumeId: 'resume-marketing', hhVacancyId: '103', searchId: 'search-python', title: 'Разработчик Python',
    company: { id: '16842', name: 'Инновации' },
    salary: { from: 120000, to: 160000, currency: 'RUR', gross: true },
    location: 'Санкт-Петербург', workFormat: 'Удалённо', experience: '1–3 года', publishedAt: '2026-08-30T18:32:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'USER_SKIPPED', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
  },
  {
    id: 'vacancy-104', resumeId: 'resume-marketing', hhVacancyId: '104', searchId: 'search-python', title: 'Python Developer (Senior)',
    company: { id: '22518', name: 'CloudTech' },
    salary: { from: 250000, to: 300000, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Удалённо', experience: '3–6 лет', publishedAt: '2026-08-30T16:05:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'ALREADY_APPLIED', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
  },
  {
    id: 'vacancy-105', resumeId: 'resume-marketing', hhVacancyId: '105', searchId: 'search-python', title: 'Разработчик API (Python)',
    company: { id: '31706', name: 'WebSolutions' },
    salary: { from: 140000, to: 180000, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Офис', experience: '1–3 года', publishedAt: '2026-08-29T20:24:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'COMPANY_BANNED', queuedForApplication: false, banScope: 'RESUME', hasQuestionnaire: false,
  },
  {
    id: 'vacancy-106', resumeId: 'resume-marketing', hhVacancyId: '106', searchId: 'search-django', title: 'Django Developer',
    company: { id: '40125', name: 'MarketFlow' },
    salary: null,
    location: 'Казань', workFormat: 'Удалённо', experience: '1–3 года', publishedAt: '2026-08-29T14:12:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'NEW', queuedForApplication: false, banScope: null, hasQuestionnaire: true,
  },
  {
    id: 'vacancy-107', resumeId: 'resume-marketing', hhVacancyId: '107', searchId: 'search-django', title: 'Python Backend Engineer',
    company: { id: '53811', name: 'FinCore' },
    salary: { from: 210000, to: 270000, currency: 'RUR', gross: true },
    location: 'Москва', workFormat: 'Гибрид', experience: '3–6 лет', publishedAt: '2026-08-28T11:45:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'NEW', queuedForApplication: true, banScope: null, hasQuestionnaire: false,
  },
  {
    id: 'vacancy-108', resumeId: 'resume-marketing', hhVacancyId: '108', searchId: 'search-django', title: 'Инженер автоматизации',
    company: { id: '3529', name: 'ТехноСофт' },
    salary: { from: 130000, to: null, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Удалённо', experience: '1–3 года', publishedAt: '2026-08-27T13:16:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'NEW', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
  },
  {
    id: 'vacancy-109', resumeId: 'resume-java', hhVacancyId: '109', searchId: 'search-data', title: 'Data Engineer / Python',
    company: { id: '67204', name: 'Analytics Lab' },
    salary: { from: 190000, to: 240000, currency: 'RUR', gross: false },
    location: 'Москва', workFormat: 'Удалённо', experience: '3–6 лет', publishedAt: '2026-08-26T09:20:00+03:00',
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [], status: 'CLOSED', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
  },
]

const generatedCompanies = [
  { id: '78312', name: 'ПГК Орбита новые горизонты и нанотехнологии' },
  { id: '84507', name: 'Вектор' },
  { id: '90614', name: 'Северные системы' },
  { id: '102438', name: 'Пиксель' },
  { id: '117503', name: 'КодФабрика' },
  { id: '128640', name: 'Лайм Технологии' },
]
const generatedTitles = [
  'Backend-разработчик Python',
  'Python Engineer',
  'Разработчик интеграций',
  'Инженер backend-платформы',
  'Django-разработчик',
  'Python-разработчик внутренних сервисов',
]
const generatedStatuses: Vacancy['status'][] = [
  'NEW', 'NEW', 'NEW', 'USER_SKIPPED', 'ALREADY_APPLIED', 'NEW', 'COMPANY_BANNED', 'CLOSED',
]

const generatedVacancies: Vacancy[] = Array.from({ length: 27 }, (_, index) => {
  const sequence = index + 110
  const status = generatedStatuses[index % generatedStatuses.length]!
  const day = 25 - Math.floor(index / 4)
  const company = generatedCompanies[index % generatedCompanies.length]!
  const searchId = index % 3 === 0 ? 'search-django' : index % 3 === 1 ? 'search-python' : 'search-data'
  return {
    id: `vacancy-${sequence}`,
    resumeId: searchId === 'search-data' ? 'resume-java' : 'resume-marketing',
    hhVacancyId: String(sequence),
    searchId,
    title: `${generatedTitles[index % generatedTitles.length]!} ${index % 4 === 0 ? '(Middle)' : ''}`.trim(),
    company,
    salary: index % 5 === 0
      ? null
      : { from: 120000 + (index % 6) * 20000, to: 170000 + (index % 6) * 20000, currency: 'RUR', gross: index % 3 === 0 },
    location: index % 4 === 0 ? 'Санкт-Петербург' : index % 4 === 1 ? 'Казань' : 'Москва',
    workFormat: index % 3 === 0 ? 'Гибрид' : index % 3 === 1 ? 'Офис' : 'Удалённо',
    experience: index % 4 === 0 ? 'Без опыта' : index % 4 === 1 ? '1–3 года' : '3–6 лет',
    publishedAt: `2026-08-${String(day).padStart(2, '0')}T${String(9 + index % 9).padStart(2, '0')}:15:00+03:00`,
    salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    labels: [],
    status,
    queuedForApplication: status === 'NEW' && index % 7 === 0,
    banScope: status === 'COMPANY_BANNED' ? (index % 2 === 0 ? 'GLOBAL' : 'RESUME') : null,
    hasQuestionnaire: index % 6 === 0,
  }
})

const formatCodes: Record<string, string[]> = {
  'Удалённо': ['REMOTE'],
  'Гибрид': ['HYBRID', 'REMOTE'],
  'Офис': ['ON_SITE'],
}

export function createVacancyEnrichmentMock(vacancy: Vacancy, index = 0): VacancyEnrichment {
  const publishedAt = vacancy.publishedAt ?? '2026-08-31T10:24:00+03:00'
  const publishedTime = Date.parse(publishedAt)
  const compensation = vacancy.salary ? {
    from: vacancy.salary.from,
    to: vacancy.salary.to,
    currency: vacancy.salary.currency,
    gross: vacancy.salary.gross,
    mode: 'MONTH',
    frequency: index % 4 === 0 ? 'TWICE_PER_MONTH' : index % 4 === 1 ? 'MONTHLY' : null,
  } : null
  const isMoscow = vacancy.location === 'Москва'
  const isDeveloper = /developer|разработчик|engineer/i.test(vacancy.title)
  return {
    workFormats: formatCodes[vacancy.workFormat] ?? [],
    employmentForm: index % 9 === 5 ? 'PART' : 'FULL',
    workScheduleByDays: [index % 5 === 3 ? 'FLEXIBLE' : 'FIVE_ON_TWO_OFF'],
    workingHours: [index % 6 === 2 ? 'FLEXIBLE' : 'HOURS_8'],
    nightShifts: index % 11 === 7,
    sideJob: index % 9 === 5,
    temporary: index % 13 === 8,
    internship: vacancy.experience === 'Без опыта' && index % 2 === 0,
    civilLawContracts: index % 7 === 2 ? ['SELF_EMPLOYED', 'INDIVIDUAL_ENTREPRENEUR'] : [],
    flyInFlyOutDurations: [],
    compensation,
    responsesCount: 18 + index * 17,
    totalResponsesCount: 23 + index * 19,
    responseLetterRequired: index % 4 === 1,
    userTestPresent: vacancy.hasQuestionnaire,
    questionInputAvailable: index % 3 !== 0,
    incompleteResumesAccepted: index % 8 === 3,
    showContact: index % 5 === 0,
    inboxPossible: true,
    chatWritePossibility: index % 3 === 0 ? 'ENABLED_AFTER_INVITATION' : 'ENABLED',
    professionalRoles: [isDeveloper ? 'Программист, разработчик' : 'Специалист по автоматизации'],
    languages: index % 5 === 1 ? [{ code: 'eng', level: 'b1' }] : [],
    inclusivenessTypes: index % 10 === 4 ? ['CHRONIC_DISEASES'] : [],
    accreditedItEmployer: index % 3 !== 2,
    trustedEmployer: index % 7 !== 6,
    companySiteUrl: index % 4 === 2 ? null : `https://example.org/employers/${vacancy.company.id ?? index}`,
    companyDepartment: index % 3 === 1 ? 'Разработка внутренних продуктов' : null,
    employerRating: index % 6 === 5 ? null : (3.8 + (index % 12) / 10).toFixed(1),
    employerReviewsCount: index % 6 === 5 ? null : 12 + index * 3,
    address: vacancy.workFormat === 'Удалённо' ? null : `${vacancy.location}, ул. Тестовая, 12`,
    metroStations: isMoscow && vacancy.workFormat !== 'Удалённо' ? ['Бауманская', 'Курская'] : [],
    district: isMoscow && vacancy.workFormat !== 'Удалённо' ? 'Басманный' : null,
    sourceCreatedAt: Number.isFinite(publishedTime) ? new Date(publishedTime - 14 * 86_400_000).toISOString() : null,
    sourceUpdatedAt: Number.isFinite(publishedTime) ? new Date(publishedTime + 90 * 60_000).toISOString() : null,
    creationSite: index % 4 === 0 ? 'hh.ru' : index % 4 === 1 ? 'spb.hh.ru' : 'ekaterinburg.hh.ru',
  }
}

const initialVacancies: Vacancy[] = [...baseVacancies, ...generatedVacancies]
  .map((vacancy, index) => ({
    ...vacancy,
    enrichment: createVacancyEnrichmentMock(vacancy, index),
    textLength: vacancy.status === 'ALREADY_APPLIED' ? MOCK_SAVED_VACANCY_TEXT.length : 0,
  }))

const stateByScenario = new Map<MockScenario, Vacancy[]>()

export function getVacanciesMock(scenario: MockScenario): Vacancy[] {
  const existing = stateByScenario.get(scenario)
  if (existing) return existing

  const initial = scenario === 'empty'
    ? []
    : scenario === 'partial'
      ? initialVacancies.slice(0, 3)
      : initialVacancies
  const state = structuredClone(initial)
  if (scenario === 'selected') {
    state.forEach((vacancy) => {
      if (['NEW', 'USER_SKIPPED'].includes(vacancy.status)) vacancy.queuedForApplication = true
    })
  }
  stateByScenario.set(scenario, state)
  return state
}

export async function analyzeVacanciesMock(scenario: MockScenario, vacancyIds: string[]): Promise<Vacancy[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 1100))
  const state = getVacanciesMock(scenario)
  const selected = state.filter((vacancy) => vacancyIds.includes(vacancy.id))
  selected.forEach((vacancy) => { vacancy.relevance = mockRelevance(state.indexOf(vacancy), vacancy.title) })
  return structuredClone(selected)
}

function mockRelevance(index: number, title: string): VacancyRelevance {
  if (index % 11 === 8) return { category: 'UNKNOWN', confidence: 'low', reason: 'Недостаточно данных в карточке' }
  if (index % 7 === 5) return { category: 'NOISE', confidence: 'high', reason: 'Другая профессиональная область' }
  if (index % 3 === 1) return { category: 'ADJACENT', confidence: 'medium', reason: 'Смежная специализация или стек' }
  return { category: 'TARGET', confidence: 'high', reason: title.includes('Python') ? 'Совпадает с профилем разработки' : 'Подходит к профилю резюме' }
}
