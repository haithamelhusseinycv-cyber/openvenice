/**
 * Lightweight error monitoring: captures, stores, and reports errors.
 * Sentry-compatible interface — swap in @sentry/react init when ready.
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info'

export interface CapturedError {
  id: string
  message: string
  severity: ErrorSeverity
  timestamp: number
  context?: Record<string, unknown>
  stack?: string
  reported: boolean
}

const ERROR_STORE_KEY = 'chili-error-log'
const MAX_STORED = 50

function getStoredErrors(): CapturedError[] {
  try {
    const raw = localStorage.getItem(ERROR_STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function storeErrors(errors: CapturedError[]): void {
  try {
    localStorage.setItem(ERROR_STORE_KEY, JSON.stringify(errors.slice(-MAX_STORED)))
  } catch { /* quota exceeded — drop silently */ }
}

export function captureError(
  error: Error | string,
  severity: ErrorSeverity = 'error',
  context?: Record<string, unknown>,
): CapturedError {
  const captured: CapturedError = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    message: error instanceof Error ? error.message : error,
    severity,
    timestamp: Date.now(),
    context,
    stack: error instanceof Error ? error.stack : undefined,
    reported: false,
  }

  const stored = getStoredErrors()
  stored.push(captured)
  storeErrors(stored)

  if (import.meta.env.DEV) {
    console.error(`[Chili ${severity}]`, captured.message, context)
  }

  return captured
}

export function getUnreportedErrors(): CapturedError[] {
  return getStoredErrors().filter((e) => !e.reported)
}

export function markReported(ids: string[]): void {
  const stored = getStoredErrors()
  const idSet = new Set(ids)
  for (const err of stored) {
    if (idSet.has(err.id)) err.reported = true
  }
  storeErrors(stored)
}

export function getRecentErrors(limit = 10): CapturedError[] {
  return getStoredErrors()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

export function clearErrorLog(): void {
  localStorage.removeItem(ERROR_STORE_KEY)
}

export function installGlobalHandlers(): void {
  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, 'fatal', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      'error',
      { type: 'unhandledrejection' },
    )
  })
}
