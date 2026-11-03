import { ref } from 'vue'

export const mockRevision = ref(0)
let selectedAccountId = 'account-1'
let selectedResumeId = 'resume-marketing'
const accountResumeMap: Record<string, string> = { 'account-1': 'resume-marketing', 'account-2': 'resume-java' }

export function touchMockState(): void { mockRevision.value += 1 }
export function getMockSelection(): { accountId: string; resumeId: string } { return { accountId: selectedAccountId, resumeId: selectedResumeId } }
export function selectMockAccount(accountId: string): string {
  selectedAccountId = accountId
  selectedResumeId = accountResumeMap[accountId] ?? ''
  touchMockState()
  return selectedResumeId
}

export function registerMockAccount(accountId: string): void {
  accountResumeMap[accountId] = ''
}

export function registerMockResume(accountId: string, resumeId: string): void {
  accountResumeMap[accountId] = resumeId
}
export function selectMockResume(resumeId: string): void {
  selectedResumeId = resumeId
  selectedAccountId = Object.entries(accountResumeMap).find(([, value]) => value === resumeId)?.[0] ?? selectedAccountId
  touchMockState()
}
