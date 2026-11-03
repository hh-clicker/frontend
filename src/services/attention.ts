import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import type { AttentionTask, AttentionTaskStatus } from '../api/contracts/attention'
import { getApplicationRunsMock } from '../mocks/applications'
import { getAttentionTasksMock } from '../mocks/attention'
import { getVacanciesMock } from '../mocks/vacancies'
import { getMockSelection, touchMockState } from '../mocks/state'
import { applicationContextStore } from './applicationContext'

export async function loadAttentionTasks(): Promise<AttentionTask[]> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить задачи, требующие внимания')
    const resumeName = getMockSelection().resumeId === 'resume-java' ? 'Java-разработчик' : 'Маркетолог 2024'
    const tasks = structuredClone(getAttentionTasksMock(getMockScenario()).filter((task) => task.resumeName === resumeName))
    return tasks
  }
  const resumeId = applicationContextStore.state.overview?.selectedResumeId
  if (!resumeId) return []
  return apiRequest<AttentionTask[]>(`/api/v1/attention-tasks?resumeId=${encodeURIComponent(resumeId)}`)
}

export async function setAttentionTaskStatus(taskId: string, status: AttentionTaskStatus): Promise<AttentionTask> {
  if (isMockMode) {
    const task = findMockTask(taskId)
    task.status = status
    const run = getApplicationRunsMock(getMockScenario()).find(item => item.id === task.runId)
    const application = run?.applications.find(item => item.id === task.applicationId)
    if (application) application.attentionStatus = status
    if (status === 'SKIPPED' && task.vacancyId) {
      const vacancy = getVacanciesMock(getMockScenario()).find((item) => item.id === task.vacancyId)
      if (vacancy) {
        vacancy.status = 'USER_SKIPPED'
        vacancy.queuedForApplication = false
      }
      task.canSkipVacancy = false
    }
    if (run && !['COMPLETED', 'CANCELLED'].includes(run.status)
      && !run.applications.some(item => ['QUEUED', 'IN_PROGRESS'].includes(item.status))) run.status = 'COMPLETED'
    touchMockState()
    return structuredClone(task)
  }
  return apiRequest<AttentionTask>(`/api/v1/attention-tasks/${encodeURIComponent(taskId)}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
}

function findMockTask(taskId: string): AttentionTask {
  const task = getAttentionTasksMock(getMockScenario()).find((item) => item.id === taskId)
  if (!task) throw new Error('Задача не найдена')
  return task
}
