/**
 * Retry utilities with exponential backoff for API calls
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'network',
    'timeout',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    '502',
    '503',
    '504',
    '429',
  ],
  onRetry: () => {},
}

function isRetryable(error: Error, retryableErrors: string[]): boolean {
  const msg = error.message.toLowerCase()
  return retryableErrors.some((pattern) => msg.includes(pattern.toLowerCase()))
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * baseDelayMs * 0.1
  return Math.min(exponential + jitter, maxDelayMs)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt >= opts.maxRetries) break
      if (!isRetryable(lastError, opts.retryableErrors)) throw lastError

      const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs)
      opts.onRetry(attempt + 1, lastError, delay)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number

  constructor(failureThreshold = 5, resetTimeoutMs = 60000) {
    this.failureThreshold = failureThreshold
    this.resetTimeoutMs = resetTimeoutMs
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open'
      } else {
        throw new Error('Service temporarily unavailable (circuit breaker open)')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }
}

export const veniceCircuit = new CircuitBreaker(5, 60000)
export const localDreamCircuit = new CircuitBreaker(3, 30000)
export const atelierCircuit = new CircuitBreaker(3, 45000)
