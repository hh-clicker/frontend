import type { VacancyRelevanceRun } from '../api/contracts/vacancies'

export function relevanceProgress(
  run: Pick<VacancyRelevanceRun, 'evaluatedBefore' | 'evaluatedCount' | 'totalCount'>,
  initial: { evaluated: number; total: number },
): { evaluated: number; total: number } {
  return { evaluated: (run.evaluatedBefore ?? initial.evaluated) + run.evaluatedCount,
    total: run.totalCount ?? initial.total }
}
