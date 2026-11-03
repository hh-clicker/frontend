export interface ParsedHhEmployerUrl {
  employerId: string
  canonicalUrl: string
}

export function parseHhEmployerUrl(value: string): ParsedHhEmployerUrl | null {
  const source = value.trim()
  if (!source) return null
  try {
    const url = new URL(source)
    const hostname = url.hostname.toLocaleLowerCase('en-US')
    if (url.protocol !== 'https:' || (hostname !== 'hh.ru' && !hostname.endsWith('.hh.ru'))) return null
    const match = url.pathname.match(/^\/employer\/(\d+)\/?$/)
    const employerId = match?.[1]
    if (!employerId) return null
    return { employerId, canonicalUrl: `https://hh.ru/employer/${employerId}` }
  } catch {
    return null
  }
}
