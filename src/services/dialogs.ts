import { shallowRef } from 'vue'
import type { CompanyBanScope } from '../api/contracts/vacancies'

type DialogKind = 'confirm' | 'scope'
type DialogResult = boolean | CompanyBanScope | null

export interface DialogRequest {
  id: number
  kind: DialogKind
  tone: 'warning' | 'info'
  title: string
  description: string
  confirmText: string
  confirmVariant: 'primary' | 'danger'
  cancelText?: string
}

interface QueuedDialog {
  request: DialogRequest
  resolve: (result: DialogResult) => void
}

export const activeDialog = shallowRef<DialogRequest | null>(null)

let nextDialogId = 1
let activeResolve: QueuedDialog['resolve'] | null = null
const dialogQueue: QueuedDialog[] = []

function showNextDialog(): void {
  if (activeDialog.value || dialogQueue.length === 0) return
  const next = dialogQueue.shift()!
  activeResolve = next.resolve
  activeDialog.value = next.request
}

function openDialog<T extends DialogResult>(request: Omit<DialogRequest, 'id'>): Promise<T> {
  return new Promise<T>((resolve) => {
    dialogQueue.push({ request: { ...request, id: nextDialogId++ }, resolve: resolve as (result: DialogResult) => void })
    showNextDialog()
  })
}

export function resolveDialog(result: DialogResult): void {
  if (!activeDialog.value || !activeResolve) return
  const resolve = activeResolve
  activeResolve = null
  activeDialog.value = null
  resolve(result)
  queueMicrotask(showNextDialog)
}

export function confirmArchiveSearch(searchName: string): Promise<boolean> {
  return openDialog<boolean>({
    kind: 'confirm', tone: 'warning', title: 'Архивировать поиск?',
    description: `«${searchName}» исчезнет из списка, но найденные вакансии и история откликов сохранятся.`,
    confirmText: 'Архивировать', confirmVariant: 'danger', cancelText: 'Отмена',
  })
}

export function confirmRemoveCompanyBan(companyName: string, hiddenVacanciesCount: number): Promise<boolean> {
  const remainder100 = hiddenVacanciesCount % 100
  const remainder10 = hiddenVacanciesCount % 10
  const vacancyPhrase = remainder100 >= 11 && remainder100 <= 14
    ? `${hiddenVacanciesCount} вакансий вернутся`
    : remainder10 === 1
      ? `${hiddenVacanciesCount} вакансия вернётся`
      : remainder10 >= 2 && remainder10 <= 4
        ? `${hiddenVacanciesCount} вакансии вернутся`
        : `${hiddenVacanciesCount} вакансий вернутся`

  return openDialog<boolean>({
    kind: 'confirm', tone: 'warning', title: `Разблокировать «${companyName}»?`,
    description: `${vacancyPhrase} в раздел «Новые», если они ещё актуальны. В очередь отклика они не попадут.`,
    confirmText: 'Разблокировать', confirmVariant: 'primary', cancelText: 'Отмена',
  })
}

export function chooseCompanyBanScope(companyName: string): Promise<CompanyBanScope | null> {
  return openDialog<CompanyBanScope | null>({
    kind: 'scope', tone: 'warning', title: `Заблокировать «${companyName}»?`,
    description: 'Вакансии этой компании больше не будут предлагаться к отклику.',
    confirmText: 'Заблокировать', confirmVariant: 'danger', cancelText: 'Отмена',
  })
}
