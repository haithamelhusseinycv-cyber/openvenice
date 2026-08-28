import type { VeniceError } from '../types/venice'
import { useAuthStore } from '../stores/auth-store'

const ENV_BASE = (import.meta.env.VITE_VENICE_BASE_URL as string | undefined)?.replace(/\/$/, '')
export const VENICE_BASE_URL = ENV_BASE || (import.meta.env.DEV ? '/venice/api/v1' : 'https://api.venice.ai/api/v1')
const BASE_URL = VENICE_BASE_URL

const RETRY_STATUSES = new Set([408, 425, 500, 502, 503, 504])
const MAX_READ_RETRIES = 2

const PAID_PATH = /\/(image\/(generate|multi-edit|edit|upscale|background-remove)|chat\/completions|audio\/|video\/|embeddings)/

export class VeniceAPIError extends Error {
  status: number
  code?: string
  suggestedPrompt?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, suggestedPrompt?: string, details?: unknown) {
    super(message)
    this.name = 'VeniceAPIError'
    this.status = status
    this.code = code
    this.suggestedPrompt = suggestedPrompt
    this.details = details
  }
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

function defaultRetries(method: string | undefined, path: string, explicit?: number): number {
  if (explicit !== undefined) return explicit
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET' || m === 'HEAD') return MAX_READ_RETRIES
  if (PAID_PATH.test(path)) return 0
  return 0
}

export async function parseVeniceErrorPayload(raw: string, status: number): Promise<VeniceAPIError> {
  let message = raw?.trim() || `HTTP ${status}`
  let code: string | undefined
  let suggestedPrompt: string | undefined
  let details: unknown
  try {
    const err = JSON.parse(raw) as VeniceError & {
      error?: string | { message?: string; code?: string; suggested_prompt?: string }
      message?: string
      details?: unknown
    }
    if (typeof err?.error === 'string') {
      message = err.error || message
      details = err.details
    } else if (err?.error && typeof err.error === 'object') {
      message = err.error.message || message
      code = err.error.code
      suggestedPrompt = err.error.suggested_prompt
      details = err.details
    } else if (typeof err?.message === 'string') {
      message = err.message
      details = err.details
    }
  } catch {
    /* keep text body */
  }
  return new VeniceAPIError(message, status, code, suggestedPrompt, details)
}

async function parseError(res: Response): Promise<VeniceAPIError> {
  const raw = await res.text()
  return parseVeniceErrorPayload(raw, res.status)
}

interface VeniceFetchOptions extends RequestInit {
  stream?: boolean
  noAuth?: boolean
  retries?: number
}

async function veniceFetch(path: string, options: VeniceFetchOptions): Promise<Response> {
  const method = options.method || (options.body ? 'POST' : 'GET')
  const { stream, noAuth, retries: explicitRetries, ...fetchOptions } = options
  const retries = defaultRetries(method, path, explicitRetries)
  const headers = new Headers(fetchOptions.headers)
  if (!noAuth) headers.set('Authorization', `Bearer ${getApiKey()}`)
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, method, headers })
      if (res.ok) return res

      if (res.status === 429) {
        const err = await parseError(res)
        err.message = err.message || 'Rate limited. Wait and retry manually.'
        throw err
      }

      if (!RETRY_STATUSES.has(res.status) || attempt === retries) throw await parseError(res)

      try { await res.arrayBuffer() } catch { /* noop */ }
      await sleep(backoffDelay(attempt, res.headers.get('Retry-After')))
      continue
    } catch (err) {
      lastErr = err
      if (err instanceof VeniceAPIError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (attempt === retries) break
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
  })
  return res.blob()
}
