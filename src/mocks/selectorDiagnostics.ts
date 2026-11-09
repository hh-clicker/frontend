import type { DiagnosticMode, DiagnosticPageType, SelectorDiagnosticReport } from '../api/contracts/browser'
import type { MockScenario } from '../app/runtime'
import { selectorDiagnosticSummary } from '../services/selectorDiagnosticSummary.ts'

type Row = SelectorDiagnosticReport['rows'][number]
const pages: DiagnosticPageType[] = ['PROFILE', 'RESUME', 'SEARCH', 'VACANCY']
const names = ['Профиль', 'Печатное резюме', 'Поиск Java-разработчика', 'Вакансия Java-разработчика']
const groups = ['profile', 'resumeText', 'search', 'vacancy']
const tabIds = pages.map((_, index) => `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`)

export function runtimeSelectorIssuesMock(searchIds: string[], applicationIds: string[], scenario: MockScenario) {
  if (['empty', 'mixed', 'agent-offline'].includes(scenario)) return []
  const report = (pageType: DiagnosticPageType): SelectorDiagnosticReport => {
    const index = pages.indexOf(pageType)
    const group = groups[index]!
    return { pageType, checkedAt: new Date().toISOString(), status: 'CHECKED', summary: 'FAILED', tabId: tabIds[index]!,
      message: pageType === 'SEARCH' ? 'Дополнительные поля могли быть прочитаны не полностью. Сбор вакансий продолжился.' : 'Не удалось прочитать обязательные элементы страницы.',
      rows: [{ group, key: pageType === 'SEARCH' ? 'experience' : pageType === 'PROFILE' ? 'root' : 'description',
        purpose: pageType === 'SEARCH' ? 'Требуемый опыт' : pageType === 'PROFILE' ? 'Раздел резюме' : 'Текст вакансии',
        selector: 'css=.missing-demo-field', source: 'BUNDLED', required: pageType !== 'SEARCH',
        status: 'FAIL', matched: 0, visible: 0, message: 'Элемент не прочитан.' }], repairableGroups: [] }
  }
  return [
    { commandId: 'demo-profile', searchId: null, applicationId: null, completedAt: new Date().toISOString(), report: report('PROFILE') },
    ...searchIds.map(id => ({ commandId: `demo-${id}`, searchId: id, applicationId: null, completedAt: new Date().toISOString(), report: report('SEARCH') })),
    ...applicationIds.map(id => ({ commandId: `demo-${id}`, searchId: null, applicationId: id, completedAt: new Date().toISOString(), report: report('VACANCY') })),
  ]
}

/** Synthetic workflow only. Every instance has independent in-memory mock state. */
export function createSelectorDiagnosticsMock() {
  const sessions = new Map<string, { repaired: Set<string>; full: boolean }>()
  return (accountId: string, resumeId: string | null | undefined, scenario: MockScenario, mode: DiagnosticMode,
      tabId?: string | null, repairGroup?: string | null): SelectorDiagnosticReport => {
    const key = JSON.stringify([accountId, resumeId, scenario])
    const state = sessions.get(key) ?? { repaired: new Set(scenario === 'mixed' ? groups : scenario === 'partial' ? groups.slice(0, 3) : []), full: false }
    sessions.set(key, state)
    const row = (group: string, key: string, purpose: string, status: Row['status'], matched: number, selector: string, message?: string): Row => ({
      group, key, purpose, selector: `css=${selector}`, source: state.repaired.has(group) ? 'LOCAL' : 'BUNDLED',
      status, matched, visible: key === 'initialState' ? 0 : matched,
      required: ['root','title','description','resumeLink','ready','cards'].includes(key),
      message: message ?? (status === 'PASS' ? 'Элемент и читаемые поля соответствуют контракту.'
        : status === 'FAIL' ? 'Количество элементов или читаемые поля не соответствуют контракту.'
          : status === 'STATE_NOT_CHECKED' ? 'Нужное состояние страницы сейчас не наблюдается.'
            : status === 'NOT_CHECKED' ? 'Проверка зависит от распознавания родительского элемента.' : 'Элемент не требуется в текущем варианте страницы.'),
    })
    const step = (pageType: DiagnosticPageType, dependencies: boolean): SelectorDiagnosticReport => {
      const index = pages.indexOf(pageType)
      const group = groups[index]!
      const fixed = state.repaired.has(group)
      const blocked = dependencies && (pageType === 'RESUME' && !state.repaired.has('profile') || pageType === 'VACANCY' && !state.repaired.has('search'))
      const rows: Row[] = blocked ? [] : pageType === 'PROFILE' ? [
        row(group, 'root', 'Корень личного профиля', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 3, fixed ? '.profile' : 'main, header, footer', fixed ? undefined : 'Найдено 3 области вместо одной.'),
        row(group, 'resumeSection', 'Раздел резюме', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 2, 'h2'),
        row(group, 'resumeCards', 'Карточки резюме', fixed ? 'PASS' : 'NOT_APPLICABLE', fixed ? 1 : 0, '.resume-card'),
        row(group, 'resumeLink', 'Ссылка на резюме', fixed ? 'PASS' : 'NOT_CHECKED', fixed ? 1 : 0, 'a.resume-view'),
      ] : pageType === 'RESUME' ? [
        row(group, 'root', 'Область печатного резюме', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 0, 'main.resume'),
        row(group, 'ready', 'Название должности', fixed ? 'PASS' : 'NOT_CHECKED', fixed ? 1 : 0, 'h1'),
        row(group, 'blocks', 'Профессиональные разделы', fixed ? 'PASS' : 'NOT_CHECKED', fixed ? 7 : 0, '.resume-section'),
      ] : pageType === 'SEARCH' ? [
        row(group, 'cards', 'Карточки вакансий', 'PASS', fixed ? 100 : 1, fixed ? '.vacancy-card' : 'main'),
        row(group, 'title', 'Название и ссылка вакансии', fixed ? 'PASS' : 'FAIL', fixed ? 100 : 554, fixed ? 'a.vacancy-title' : 'a[href]', fixed ? undefined : 'Селектор захватывает посторонние ссылки.'),
        row(group, 'pager', 'Навигация по страницам', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 5, fixed ? '.pager' : 'nav, header'),
        row(group, 'employerName', 'Название работодателя', fixed ? 'PASS' : 'FAIL', fixed ? 100 : 4, '.company-name'),
        row(group, 'labels', 'Дополнительные признаки вакансий', fixed ? 'PASS' : 'NOT_APPLICABLE', fixed ? 80 : 0, '.vacancy-label'),
        row(group, 'salarySpan', 'Строка зарплаты', fixed ? 'PASS' : 'NOT_APPLICABLE', fixed ? 14 : 0, '.salary'),
        row(group, 'initialState', 'Структурированные данные выдачи', 'PASS', 1, 'template'),
      ] : [
        row(group, 'title', 'Заголовок вакансии', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 4, fixed ? 'h1.vacancy-title' : 'h1, h2, h3'),
        row(group, 'description', 'Описание работодателя', fixed ? 'PASS' : 'FAIL', fixed ? 1 : 36, fixed ? '.vacancy-description' : 'p, li'),
        row(group, 'archivedTitle', 'Признак архивной вакансии', 'STATE_NOT_CHECKED', 0, '.archive', 'Вакансия не архивная; это состояние не проверялось.'),
        row('responseForm', 'form', 'Форма отклика', 'STATE_NOT_CHECKED', 0, 'form.response', 'Форма не открыта. Откройте её вручную, чтобы проверить.'),
        row('letterForm', 'form', 'Форма добавления письма', 'STATE_NOT_CHECKED', 0, 'form.letter', 'Форма не открыта; отправка не проверялась.'),
      ]
      const result: SelectorDiagnosticReport = {
        pageType, checkedAt: new Date().toISOString(), status: blocked ? 'BLOCKED' : 'CHECKED', rows,
        message: blocked ? `Проверка зависит от исправления ${pageType === 'RESUME' ? 'профиля' : 'поиска'}.`
          : fixed ? 'Проверки текущего состояния пройдены.' : 'Обнаружены проблемы в селекторах чтения.',
        ...(blocked ? {} : { tabId: tabIds[index]!, repairableGroups: fixed ? [] : [group] }),
        ...(pageType === 'SEARCH' ? { contextLabel: 'Java-разработчик · Москва и удалённо' } : {}),
        ...(fixed ? { repairNote: 'Демонстрационное исправление применено. Настоящий ИИ не вызывался.' } : {}),
      }
      result.summary = selectorDiagnosticSummary(result)
      return result
    }
    const full = (): SelectorDiagnosticReport => {
      const result: SelectorDiagnosticReport = { pageType: 'FULL', checkedAt: new Date().toISOString(), status: 'CHECKED',
        message: 'Демонстрационная диагностика.', rows: [], scenarios: pages.map(page => step(page, true)) }
      result.summary = selectorDiagnosticSummary(result)
      return result
    }
    if (repairGroup) {
      const index = tabIds.indexOf(tabId ?? '')
      if (index < 0 || groups[index] !== repairGroup || state.repaired.has(repairGroup)) throw new Error('Обновите диагностику и выберите доступное исправление.')
      if (scenario === 'error') throw new Error('ИИ не подтвердил полноту применимых полей. Демонстрационная ошибка, исправление не сохранено.')
      state.repaired.add(repairGroup)
      return state.full ? full() : step(pages[index]!, false)
    }
    state.full = mode === 'FULL'
    if (mode === 'FULL') return full()
    if (!tabId) return { pageType: 'UNKNOWN', checkedAt: new Date().toISOString(), status: 'SELECT_TAB', rows: [],
      message: 'Выберите открытую вкладку для проверки.', tabs: pages.map((_, index) => ({ tabId: tabIds[index]!, label: `${index + 1}. ${names[index]}` })) }
    const index = tabIds.indexOf(tabId)
    if (index < 0) throw new Error('Вкладка закрыта или список устарел. Обновите список вкладок.')
    return step(pages[index]!, false)
  }
}
