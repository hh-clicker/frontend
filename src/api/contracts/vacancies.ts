export type VacancyStatus =
  | 'NEW'
  | 'USER_SKIPPED'
  | 'COMPANY_BANNED'
  | 'ALREADY_APPLIED'
  | 'CLOSED'

export type CompanyBanScope = 'RESUME' | 'GLOBAL'

export type VacancyRelevanceCategory = 'TARGET' | 'ADJACENT' | 'UNKNOWN' | 'NOISE'

export interface VacancyRelevance {
  category: VacancyRelevanceCategory
  confidence: 'high' | 'medium' | 'low'
  reason: string
  analyzedAt?: string
}

export interface VacancySalary {
  from: number | null
  to: number | null
  currency: 'RUR' | 'USD' | 'EUR'
  gross: boolean
}

export interface VacancyCompany {
  id: string | null
  name: string
}

export interface VacancyEnrichment {
  workFormats: string[]
  employmentForm: string | null
  workScheduleByDays: string[]
  workingHours: string[]
  nightShifts: boolean | null
  sideJob: boolean | null
  temporary: boolean | null
  internship: boolean | null
  civilLawContracts: string[]
  flyInFlyOutDurations: string[]
  compensation: { from: number | null; to: number | null; currency: string | null; gross: boolean | null; mode: string | null; frequency: string | null } | null
  responsesCount: number | null
  totalResponsesCount: number | null
  responseLetterRequired: boolean | null
  userTestPresent: boolean | null
  questionInputAvailable: boolean | null
  incompleteResumesAccepted: boolean | null
  showContact: boolean | null
  inboxPossible: boolean | null
  chatWritePossibility: string | null
  professionalRoles: string[]
  languages: Array<{ code: string; level: string }>
  inclusivenessTypes: string[]
  accreditedItEmployer: boolean | null
  trustedEmployer: boolean | null
  companySiteUrl: string | null
  companyDepartment: string | null
  employerRating: string | null
  employerReviewsCount: number | null
  address: string | null
  metroStations: string[]
  district: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  creationSite: string | null
}

export interface Vacancy {
  id: string
  resumeId: string
  hhVacancyId: string
  searchId: string | null
  title: string
  company: VacancyCompany
  salary: VacancySalary | null
  location: string
  workFormat: string
  experience: string
  publishedAt: string | null
  salaryText: string
  firstSeenAt: string
  lastSeenAt: string
  labels: string[]
  status: VacancyStatus
  queuedForApplication: boolean
  relevance?: VacancyRelevance | null
  /** Number of characters in the saved vacancy description; zero when no text is available. */
  textLength?: number
  /** Informational only: the next explicit run rechecks HH before applying. */
  hasUnconfirmedApplication?: boolean
  banScope: CompanyBanScope | null
  hasQuestionnaire: boolean | null
  enrichment?: VacancyEnrichment | null
}
export interface VacancyText {
  plainText: string | null
  textLoadedAt: string | null
}

export interface VacancyRelevanceRun {
  id: string
  resumeId: string
  status: 'queued' | 'running' | 'done' | 'failed'
  requestedCount: number
  evaluatedCount: number
  missingCount: number
  errorCode: string | null
  errorMessage: string | null
  evaluatedBefore?: number
  totalCount?: number
  batchCount?: number
  completedBatches?: number
  benchmark?: boolean
}
