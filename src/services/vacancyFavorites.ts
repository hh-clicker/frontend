import { apiRequest } from '../api/client'
import { getMockScenario, isMockMode } from '../app/runtime'
import { getVacanciesMock } from '../mocks/vacancies'
import { getResumesMock } from '../mocks/resumes'

export interface VacancyFavorites {
  accountId: string
  vacancyIds: string[]
  employerIds: string[]
}
const mockFavorites = new Map<string, VacancyFavorites>()

export async function loadVacancyFavorites(accountId: string | null | undefined): Promise<VacancyFavorites> {
  if (!accountId) return { accountId: '', vacancyIds: [], employerIds: [] }
  if (isMockMode) {
    const key = `${getMockScenario()}:${accountId}`
    if (!mockFavorites.has(key)) mockFavorites.set(key, { accountId, vacancyIds: [], employerIds: [] })
    return structuredClone(mockFavorites.get(key)!)
  }
  return apiRequest<VacancyFavorites>(`/api/v1/vacancy-favorites?accountId=${encodeURIComponent(accountId)}`)
}

export async function setVacancyFavorite(vacancyId: string, employer: boolean, favorite: boolean): Promise<VacancyFavorites> {
  if (isMockMode) {
    const vacancy = getVacanciesMock(getMockScenario()).find((item) => item.id === vacancyId)
    if (!vacancy) throw new Error('Вакансия не найдена')
    const resume = getResumesMock(getMockScenario()).items.find((item) => item.id === vacancy.resumeId)
    if (!resume) throw new Error('Резюме не найдено')
    const targetId = employer ? vacancy.company.id : vacancy.hhVacancyId
    if (!targetId) throw new Error('HH не указал ID работодателя')
    const state = await loadVacancyFavorites(resume.accountId)
    const key = employer ? 'employerIds' : 'vacancyIds'
    state[key] = favorite ? [...new Set([...state[key], targetId])] : state[key].filter((id) => id !== targetId)
    mockFavorites.set(`${getMockScenario()}:${resume.accountId}`, state)
    return structuredClone(state)
  }
  return apiRequest<VacancyFavorites>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/${employer ? 'employer-favorite' : 'favorite'}`, {
    method: 'PUT', body: JSON.stringify({ favorite }),
  })
}
