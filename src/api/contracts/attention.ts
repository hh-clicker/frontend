import type { ApplicationOutcome } from './applications'

export type AttentionTaskKind = 'QUESTIONNAIRE' | 'CAPTCHA' | 'AUTH' | 'ERROR'
export type AttentionTaskStatus = 'OPEN' | 'RESOLVED' | 'SKIPPED'

export interface AttentionTask {
  id: string
  kind: AttentionTaskKind
  status: AttentionTaskStatus
  title: string
  description: string
  runId: string
  runSequence: number
  applicationId: string | null
  vacancyId: string | null
  hhVacancyId?: string
  vacancyTitle: string | null
  employerId?: string | null
  companyName: string | null
  resumeName: string
  occurredAt: string
  outcome?: ApplicationOutcome
  canContinueRun?: boolean
  canSkipVacancy?: boolean
}
