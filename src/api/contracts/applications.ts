export type ApplicationRunStatus =
  | 'RUNNING'
  | 'PAUSED_USER'
  | 'PAUSED_CAPTCHA'
  | 'PAUSED_AUTH'
  | 'PAUSED_ERROR'
  | 'PAUSED_LIMIT'
  | 'PAUSED_AI_LIMIT'
  | 'COMPLETED'
  | 'CANCELLED'

export type ApplicationStatus =
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'ATTENTION_REQUIRED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED'

export interface ApplicationItem {
  letter?: { text: string; source: 'GENERATED' | 'FALLBACK' | 'STATIC' | 'AI_FAILED'; errorCode: string | null; generationId: string | null } | null
  id: string
  vacancyId: string
  hhVacancyId?: string
  vacancyTitle: string
  companyName: string
  status: ApplicationStatus
  attemptedAt: string | null
  message: string | null
  hasQuestionnaire: boolean
  outcome?: ApplicationOutcome | null
  attentionStatus?: 'OPEN' | 'RESOLVED' | 'SKIPPED'
}

export type ApplicationOutcome = 'SENT' | 'SENT_LETTER_UNCONFIRMED' | 'SENT_LETTER_REJECTED_ALREADY_VIEWED'
  | 'ALREADY_APPLIED' | 'QUESTIONNAIRE'
  | 'LETTER_REQUIRED' | 'RESUME_UNAVAILABLE' | 'RESUME_NOT_FOUND' | 'VACANCY_UNAVAILABLE' | 'VACANCY_ARCHIVED'
  | 'BROWSER_UNAVAILABLE' | 'CAPTCHA' | 'AUTH' | 'UNKNOWN' | 'NOT_SENT' | 'STOPPED' | 'AI_LETTER_FAILED'
  | 'TEXT_LOADED' | 'TEXT_UNAVAILABLE'

export interface ApplicationRunSummary {
  mode?: 'APPLY' | 'DRY_RUN'
  id: string
  sequence: number
  resumeId: string
  resumeName: string
  status: ApplicationRunStatus
  createdAt: string
  total: number
  attention: number
  revision: string
  estimatedRemainingSeconds: number | null
}

export interface ApplicationRun {
  /** Older API responses without mode represent real applications. */
  mode?: 'APPLY' | 'DRY_RUN'
  aiLimitResetsAt?: string | null
  aiFallbackConfirmed?: boolean
  aiLetter?: import('../../services/aiLetters').AiLetterSettings
  id: string
  sequence: number
  resumeId: string
  resumeName: string
  status: ApplicationRunStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  dailyLimit: number
  pauseFromSeconds: number
  pauseToSeconds: number
  coverLetter: string
  skipQuestionnaires: boolean
  applications: ApplicationItem[]
}

export interface ApplicationRunSettings {
  mode?: 'APPLY' | 'DRY_RUN'
  aiLetter?: import('../../services/aiLetters').AiLetterSettings
  dailyLimit: number
  pauseFromSeconds: number
  pauseToSeconds: number
  coverLetter: string
  skipQuestionnaires: boolean
}

export interface StartApplicationRunRequest extends ApplicationRunSettings {
  requestId: string
  resumeId: string
  vacancyIds: string[]
}
