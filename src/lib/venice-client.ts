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
    if (err.status === 401) return 'Venice rejected this API key. Tap the key-status dot and reconnect it.'
    if (err.status === 429) return 'Venice is rate-limiting. Wait a few seconds and retry.'
    return err.requestId ? `${err.message} · Request ${err.requestId}` : err.message
  }
  if (err instanceof Error) {
    const status = (err as { status?: number }).status
    if (status === 402) return 'Venice credits empty. Add credits on venice.ai, then retry.'
    if (status === 401) return 'Venice rejected this API key. Tap the key-status dot and reconnect it.'
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

function invalidateRejectedKey() {
  useAuthStore.getState().clearApiKey()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('venice-auth-invalid'))
  }
}

/**
 * Venice can return 401 when a particular model needs a higher access tier,
 * even though the bearer key itself is still valid. Never destroy a saved key
 * based on an inference endpoint alone: confirm it against the key-scoped
 * rate-limit endpoint first.
 */
async function resolveAuthenticatedRequest401(error: VeniceAPIError, key: string): Promise<VeniceAPIError> {
  try {
    await validateCandidateEndpoint('/api_keys/rate_limits', key, 6_000)
    return new VeniceAPIError(
      'Your API key is valid, but Venice denied access to this model or endpoint. Choose another available model and retry.',
      403,
      'MODEL_ACCESS_DENIED',
      undefined,
      error.requestId,
    )
  } catch (validationError) {
    if (validationError instanceof VeniceAPIError && validationError.status === 401) {
      invalidateRejectedKey()
      return error
    }

    return new VeniceAPIError(
      'Venice refused this request, but the key check was temporarily unavailable. Your saved key was kept; retry before reconnecting it.',
      503,
      'AUTH_CHECK_UNAVAILABLE',
      undefined,
      error.requestId,
    )
  }
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
    const err = (await res.json()) as Omit<VeniceError, 'error'> & {
      error?: VeniceError['error'] | string
      message?: string
      details?: unknown
    }
    if (typeof err.error === 'string') {
      message = err.error
    } else if (err.error?.message) {
      message = err.error.message
      code = err.error.code
      suggestedPrompt = err.error.suggested_prompt
    } else if (typeof err.message === 'string' && err.message.trim()) {
      message = err.message
    }

    const detailMessages = collectDetailMessages(err.details)
    if (detailMessages.length > 0) {
      const details = detailMessages.slice(0, 3).join('; ')
      message = message === `HTTP ${res.status}` ? details : `${message}: ${details}`
    }
  } catch {
    /* keep default */
  }
  if (res.status === 402) message = 'Venice credits empty. Add credits on venice.ai, then retry.'
  if (res.status === 401 && !message.toLowerCase().includes('api key')) {
    message = 'Venice rejected this API key. Tap the key-status dot and reconnect it.'
  }
  if (res.status === 429) message = 'Venice is rate-limiting. Wait a few seconds and retry.'
  return new VeniceAPIError(message, res.status, code, suggestedPrompt, requestId)
}

function collectDetailMessages(value: unknown, path = ''): string[] {
  if (typeof value === 'string' && value.trim()) return [path ? `${path}: ${value}` : value]
  if (Array.isArray(value)) return value.flatMap((item) => collectDetailMessages(item, path))
  if (!value || typeof value !== 'object') return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const nextPath = key === '_errors' ? path : path ? `${path}.${key}` : key
    return collectDetailMessages(item, nextPath)
  })
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
  const requestKey = noAuth ? null : getApiKey().trim()
  if (requestKey) headers.set('Authorization', `Bearer ${requestKey}`)
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let lastErr: unknown
  for (let attempt = 0; attempt <= retryLimit; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers })
      if (res.ok) return res

      if (!RETRY_STATUSES.has(res.status) || attempt === retryLimit) {
        const error = await parseError(res)
        if (res.status === 401 && requestKey) {
          throw await resolveAuthenticatedRequest401(error, requestKey)
        }
        throw error
      }

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
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await venice<T>(path, { signal: controller.signal })
  } finally {
    globalThis.clearTimeout(timeout)
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
    const payload = await res.json() as { error?: { message?: string } | string; message?: string; details?: unknown }
    const baseMessage = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message || payload.message || 'Image service returned an invalid response.'
    const details = collectDetailMessages(payload.details).slice(0, 3).join('; ')
    throw new VeniceAPIError(
      details ? `${baseMessage}: ${details}` : baseMessage,
      res.status,
      undefined,
      undefined,
      res.headers.get('cf-ray') || res.headers.get('x-request-id') || undefined,
    )
  }
  return res.blob()
}


async function validateCandidateEndpoint(path: string, key: string, timeoutMs = 8_000): Promise<void> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
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
    globalThis.clearTimeout(timeout)
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Validate a candidate key before it is stored or marked connected. */
export async function validateVeniceApiKey(key: string): Promise<void> {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    throw new VeniceAPIError('API key cannot be empty.', 401)
  }

  // This key-scoped route works for inference-only keys and also returns their
  // spend limits/balances, so it is the most reliable validation route.
  try {
    await validateCandidateEndpoint('/api_keys/rate_limits', trimmedKey)
    return
  } catch (error) {
    if (error instanceof VeniceAPIError && error.status === 401) throw error
  }

  // Account-scoped keys can validate through billing when rate-limit details
  // are unavailable. This fallback receives its own full timeout budget.
  try {
    await validateCandidateEndpoint('/billing/balance', trimmedKey)
  } catch (error) {
    if (error instanceof VeniceAPIError) throw error
    if (isAbortError(error)) {
      throw new VeniceAPIError('Venice API did not respond. Check your connection and try again.', 408)
    }
    throw error
  }
}
