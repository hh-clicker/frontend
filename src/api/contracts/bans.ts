import type { CompanyBanScope } from './vacancies'

export interface CompanyBan {
  id: string
  employerId: string
  employerUrl: string
  companyName: string
  scope: CompanyBanScope
  resumeId: string | null
  resumeName: string | null
  sourceVacancyId: string | null
  sourceVacancyTitle: string | null
  createdAt: string
  hiddenVacanciesCount: number
}

export interface SaveCompanyBanRequest {
  employerUrl: string
  companyName?: string
  scope: CompanyBanScope
  resumeId: string | null
  resumeName: string | null
  sourceVacancyId?: string | null
  sourceVacancyTitle?: string | null
  hiddenVacanciesCount?: number
}
