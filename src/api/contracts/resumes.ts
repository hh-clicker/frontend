export interface ResumeAutomationSettings {
  aiLetter?: import('../../services/aiLetters').AiLetterSettings
  coverLetter: string
  dailyLimit: number
  pauseFromSeconds: number
  pauseToSeconds: number
  skipQuestionnaires: boolean
}

export interface ResumeStatistics {
  searches: number
  newVacancies: number
  queuedVacancies: number
  successfulApplications: number
  blockedCompanies: number
}

export interface ResumeProfile {
  plainText?: string | null
  textLoadedAt?: string | null
  id: string
  hhResumeId: string
  name: string
  accountId: string
  accountName: string
  publicUrl: string
  settings: ResumeAutomationSettings
  statistics: ResumeStatistics
}

export interface ResumesResponse {
  items: ResumeProfile[]
}

export interface ImportResumeItem {
  hhResumeId: string
  name: string
  plainText: string
}
