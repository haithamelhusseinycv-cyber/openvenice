import type { VeniceError } from '../types/venice'
import { useAuthStore } from '../stores/auth-store'

const ENV_BASE = (import.meta.env.VITE_VENICE_BASE_URL as string | undefined)?.replace(/\/$/, '')
const BASE_URL = ENV_BASE || (import.meta.env.DEV ? '/venice/api/v1' : 'https://api.venice.ai/api/v1')

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2

export class VeniceAPIError extends Error {
  status: number
  code?: string
  suggestedPrompt?: string
  requestId?: string

  constructor(message: string, status: number, code?: string, suggestedPrompt?: string, requestId?: string) {
    super(message)
    this.name = 'VeniceAPIError'
    this.status = status
    this.code = code
    this.suggestedPrompt = suggestedPrompt
    this.requestId = requestId
  }
}

export function formatVeniceError(err: unknown): string {
  if (err instanceof VeniceAPIError) {
    if (err.status === 402) return 'Venice credits empty. Add credits on venice.ai, then retry.'
    if (err.status === 401) return 'API key missing or invalid. Tap Connected in the header.'
    if (err.status === 429) return 'Venice is rate-limiting. Wait a few seconds and retry.'
    return err.requestId ? `${err.message} · Request ${err.requestId}` : err.message
  }
  if (err instanceof Error) {
    const status = (err as { status?: number }).status
    if (status === 402) return 'Venice credits empty. Add credits on venice.ai, then retry.'
    if (status === 401) return 'API key missing or invalid. Tap Connected in the header.'
    if (status === 429) return 'Venice is rate-limiting. Wait a few seconds and retry.'
    if (/402|payment|credit/i.test(err.message)) return 'Venice credits empty. Add credits on venice.ai, then retry.'
    return err.message
  }
  return 'Request failed'
}

function getApiKey(): string {
  const key = useAuthStore.getState().apiKey
  if (!key) throw new VeniceAPIError('API key not set. Click "API Key" in the header to connect.', 401)
  return key
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function backoffDelay(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter)
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30_000)
  }
  const base = 500 * 2 ** attempt
  return base + Math.random() * base * 0.25
}

async function parseError(res: Response): Promise<VeniceAPIError> {
  let message = `HTTP ${res.status}`
  let code: string | undefined
  let suggestedPrompt: string | undefined
  const requestId = res.headers.get('cf-ray') || res.headers.get('x-request-id') || undefined
  try {
    const err = (await res.json()) as VeniceError
    message = err.error?.message ?? message
    code = err.error?.code
    suggestedPrompt = err.error?.suggested_prompt
  } catch {
    /* keep default */
  }
  if (res.status === 402) message = 'Venice credits empty. Add credits on venice.ai, then retry.'
  if (res.status === 401 && !message.toLowerCase().includes('api key')) {
    message = 'API key missing or invalid. Tap Connected in the header.'
  }
  if (res.status === 429) message = 'Venice is rate-limiting. Wait a few seconds and retry.'
  return new VeniceAPIError(message, res.status, code, suggestedPrompt, requestId)
}

interface VeniceFetchOptions extends RequestInit {
  stream?: boolean
  noAuth?: boolean
  retries?: number
}

async function veniceFetch(path: string, options: VeniceFetchOptions): Promise<Response> {
  const { stream, noAuth, retries, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const retryLimit = retries ?? (method === 'GET' || method === 'HEAD' ? MAX_RETRIES : 0)
  const headers = new Headers(fetchOptions.headers)
  if (!noAuth) headers.set('Authorization', `Bearer ${getApiKey()}`)
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let lastErr: unknown
  for (let attempt = 0; attempt <= retryLimit; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers })
      if (res.ok) return res

      if (!RETRY_STATUSES.has(res.status) || attempt === retryLimit) throw await parseError(res)

      try { await res.arrayBuffer() } catch { /* noop */ }
      await sleep(backoffDelay(attempt, res.headers.get('Retry-After')))
      continue
    } catch (err) {
      lastErr = err
      if (err instanceof VeniceAPIError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (attempt === retryLimit) break
      await sleep(backoffDelay(attempt))
    }
    void stream
  }
  throw lastErr instanceof Error ? lastErr : new VeniceAPIError('Network error', 0)
}

export async function venice<T>(path: string, options: VeniceFetchOptions = {}): Promise<T> {
  const res = await veniceFetch(path, options)
  if (options.stream) return res.body as unknown as T
  return res.json() as Promise<T>
}

/** Run an authenticated Venice request with a hard, per-request deadline. */
export async function veniceWithTimeout<T>(path: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await venice<T>(path, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function veniceFormData<T>(path: string, formData: FormData, init: { signal?: AbortSignal } = {}): Promise<T> {
  const res = await veniceFetch(path, {
    method: 'POST',
    body: formData,
    signal: init.signal,
  })
  return res.json() as Promise<T>
}

export async function veniceBlob(path: string, body: object, init: { signal?: AbortSignal } = {}): Promise<Blob> {
  const res = await veniceFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: init.signal,
    retries: 1,
  })
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await res.json() as { error?: { message?: string } }
    throw new VeniceAPIError(payload.error?.message || 'Image service returned an invalid response.', res.status, undefined, undefined, res.headers.get('cf-ray') || undefined)
  }
  return res.blob()
}


async function validateCandidateEndpoint(path: string, key: string, timeoutMs = 8_000): Promise<void> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const headers = { Authorization: `Bearer ${key.trim()}` }
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    // A 402 still proves that Venice authenticated the key; it only means the
    // account cannot consume until funds are added.
    if (response.ok || response.status === 402) return
    throw await parseError(response)
  } finally {
    window.clearTimeout(timeout)
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Validate a candidate key before it is stored or marked connected. */
export async function validateVeniceApiKey(key: string): Promise<void> {
  // This key-scoped route works for inference-only keys and also returns their
  // spend limits/balances, so it is the most reliable validation route.
  try {
    await validateCandidateEndpoint('/api_keys/rate_limits', key)
    return
  } catch (error) {
    if (error instanceof VeniceAPIError && error.status === 401) throw error
  }

  // Account-scoped keys can validate through billing when rate-limit details
  // are unavailable. This fallback receives its own full timeout budget.
  try {
    await validateCandidateEndpoint('/billing/balance', key)
  } catch (error) {
    if (error instanceof VeniceAPIError) throw error
    if (isAbortError(error)) {
      throw new VeniceAPIError('Venice API did not respond. Check your connection and try again.', 408)
    }
    throw error
  }
}
