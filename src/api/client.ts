export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { detail?: string; message?: string; title?: string }
    return body.detail || body.message || body.title || `Сервер вернул ошибку ${response.status}`
  } catch {
    return `Сервер вернул ошибку ${response.status}`
  }
}
