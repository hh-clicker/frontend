import { apiRequest } from '../api/client'
import type { ImportResumeItem, ResumeAutomationSettings, ResumeProfile, ResumesResponse } from '../api/contracts/resumes'
import { getMockScenario, isMockMode } from '../app/runtime'
import { importResumeMock, getResumesMock, updateResumeSettingsMock } from '../mocks/resumes'
import { getMockSelection } from '../mocks/state'
import { readResumeTextViaAgent } from './browser'

export async function importResumes(accountId: string, selected: Pick<ImportResumeItem, 'hhResumeId' | 'name'>[], onProgress?: (index: number, total: number) => void): Promise<ResumesResponse> {
  const items: ImportResumeItem[] = []
  for (const item of selected) {
    onProgress?.(items.length + 1, selected.length)
    const plainText = await readResumeTextViaAgent(accountId, item.hhResumeId)
    items.push({ hhResumeId: item.hhResumeId, name: item.name, plainText })
  }
  if (isMockMode) {
    const existing = getResumesMock(getMockScenario()).items
    if (items.some((item) => existing.some((resume) => resume.hhResumeId === item.hhResumeId && resume.accountId !== accountId))) {
      throw new Error('Одно из выбранных резюме уже связано с другим локальным HH-аккаунтом.')
    }
    return { items: items.map((item) => {
      const saved = existing.find((resume) => resume.hhResumeId === item.hhResumeId)
      return structuredClone(saved ?? importResumeMock(getMockScenario(), accountId, item))
    }) }
  }
  return apiRequest<ResumesResponse>('/api/v1/resumes/import', { method: 'POST', body: JSON.stringify({ accountId, items }) })
}

export async function loadResumes(accountId?: string | null): Promise<ResumesResponse> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить резюме')
    const selectedAccountId = accountId ?? getMockSelection().accountId
    return structuredClone({ items: getResumesMock(getMockScenario()).items.filter((resume) => resume.accountId === selectedAccountId) })
  }
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''
  return apiRequest<ResumesResponse>(`/api/v1/resumes${query}`)
}

export async function saveResumeSettings(resumeId: string, settings: ResumeAutomationSettings): Promise<ResumeProfile> {
  if (isMockMode) return structuredClone(updateResumeSettingsMock(getMockScenario(), resumeId, settings))
  return apiRequest<ResumeProfile>(`/api/v1/resumes/${encodeURIComponent(resumeId)}/settings`, { method: 'PUT', body: JSON.stringify(settings) })
}
