import type { ParsedHhSearchUrl } from '../api/contracts/searches'

export interface HhSearchUrlResult {
  valid: boolean
  value: ParsedHhSearchUrl | null
  error: string | null
}

export function parseHhSearchUrl(rawUrl: string): HhSearchUrlResult {
  const candidate = rawUrl.trim()
  if (!candidate) return { valid: false, value: null, error: null }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { valid: false, value: null, error: 'Вставьте полную ссылку поиска HH.' }
  }

  const hostname = url.hostname.toLowerCase()
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, value: null, error: 'Ссылка должна использовать HTTP или HTTPS.' }
  }
  if (hostname !== 'hh.ru' && !hostname.endsWith('.hh.ru')) {
    return { valid: false, value: null, error: 'Ссылка должна вести на hh.ru.' }
  }
  if (url.pathname !== '/search/vacancy') {
    return { valid: false, value: null, error: 'Нужна ссылка со страницы поиска вакансий.' }
  }

  if (url.username || url.password || (url.port && url.port !== '443')) {
    return { valid: false, value: null, error: 'Ссылка не должна содержать логин или нестандартный порт.' }
  }
  if (url.searchParams.getAll('resume').length > 1) {
    return { valid: false, value: null, error: 'Параметр resume не должен повторяться.' }
  }
  const resumeId = url.searchParams.get('resume')?.trim() ?? null
  if (resumeId === '') {
    return { valid: false, value: null, error: 'Параметр resume не должен быть пустым. Удалите его или укажите резюме.' }
  }

  const ignoredParams = new Set([
    'order_by', 'items_on_page', 'page', 'search_session_id', 'ored_clusters', 'resume', 'from', 'hhtmFrom', 'hhtmSource', 'hhtmSourceLabel', 'hhtmFromLabel', 'L_save_area',
  ])
  const filters = [...new Set([...url.searchParams.keys()].filter((key) => !ignoredParams.has(key)))]

  return {
    valid: true,
    error: null,
    value: {
      resumeId,
      area: url.searchParams.get('area'),
      searchFields: url.searchParams.getAll('search_field'),
      filtersCount: filters.length,
    },
  }
}

export function normalizeHhSearchUrl(source: string): string {
  const parsed = parseHhSearchUrl(source)
  if (!parsed.valid) throw new Error(parsed.error ?? 'Некорректная ссылка поиска HH.')
  const url = new URL(source.trim())
  url.protocol = 'https:'
  url.hash = ''
  url.searchParams.set('items_on_page', '100')
  url.searchParams.set('page', '0')
  return url.toString()
}
