import type { VeniceError } from '../types/venice'
import { useAuthStore } from '../stores/auth-store'

const ENV_BASE = (import.meta.env.VITE_VENICE_BASE_URL as string | undefined)?.replace(/\/$/, '')
export const VENICE_BASE_URL = ENV_BASE || (import.meta.env.DEV ? '/venice/api/v1' : 'https://api.venice.ai/api/v1')
const BASE_URL = VENICE_BASE_URL

const RETRY_STATUSES = new Set([408, 425, 500, 502, 503, 504])
const MAX_READ_RETRIES = 2
const MAX_RETRY_DELAY_MS = 30_000

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function retryAfterDelay(value?: string | null): number | null {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS)
  }

  const date = Date.parse(value)
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS)
  }

  return null
}

function backoffDelay(attempt: number, retryAfter?: string | null): number {
  const serverDelay = retryAfterDelay(retryAfter)
  if (serverDelay !== null) return serverDelay

  const base = 500 * 2 ** attempt
  return Math.min(base + Math.random() * base * 0.25, MAX_RETRY_DELAY_MS)
}

function defaultRetries(method: string | undefined, path: string, explicit?: number): number {
  if (explicit !== undefined) return explicit
  const normalizedMethod = (method || 'GET').toUpperCase()
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return MAX_READ_RETRIES
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

async function parseError(response: Response): Promise<VeniceAPIError> {
  const raw = await response.text()
  return parseVeniceErrorPayload(raw, response.status)
}

interface VeniceFetchOptions extends RequestInit {
  stream?: boolean
  noAuth?: boolean
  retries?: number
}

async function veniceFetch(path: string, options: VeniceFetchOptions): Promise<Response> {
  const method = options.method || (options.body ? 'POST' : 'GET')
  const { stream: _stream, noAuth, retries: explicitRetries, ...fetchOptions } = options
  const retries = defaultRetries(method, path, explicitRetries)
  const headers = new Headers(fetchOptions.headers)
  if (!noAuth) headers.set('Authorization', `Bearer ${getApiKey()}`)
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, method, headers })
      if (response.ok) return response

      if (response.status === 429) {
        const error = await parseError(response)
        error.message = error.message || 'Rate limited. Wait and retry manually.'
        throw error
      }

      if (!RETRY_STATUSES.has(response.status) || attempt === retries) throw await parseError(response)

      try { await response.arrayBuffer() } catch { /* noop */ }
      await sleep(backoffDelay(attempt, response.headers.get('Retry-After')))
      continue
    } catch (err) {
      lastError = err
      if (err instanceof VeniceAPIError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (attempt === retries) break
      await sleep(backoffDelay(attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new VeniceAPIError('Network error', 0)
}

export async function venice<T>(path: string, options: VeniceFetchOptions = {}): Promise<T> {
  const response = await veniceFetch(path, options)
  if (options.stream) return response.body as unknown as T
  return response.json() as Promise<T>
}

export async function veniceFormData<T>(path: string, formData: FormData, init: { signal?: AbortSignal } = {}): Promise<T> {
  const response = await veniceFetch(path, {
    method: 'POST',
    body: formData,
    signal: init.signal,
  })
  return response.json() as Promise<T>
}

export async function veniceBlob(path: string, body: object, init: { signal?: AbortSignal } = {}): Promise<Blob> {
  const response = await veniceFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: init.signal,
  })
  return response.blob()
}
