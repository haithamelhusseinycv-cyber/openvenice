/**
 * Same-origin AI gateway client.
 *
 * The gateway is served by Nginx at /ai/v1 and proxies an OpenAI-compatible
 * backend (llama.cpp / vLLM / Ollama / RunPod / any compatible endpoint) with
 * the upstream credential injected server-side. The browser never receives the
 * upstream token and never needs to know the upstream origin.
 *
 * Routes (see nginx.ai.conf.template):
 *   GET  /ai/v1/health            -> gateway configuration state (200/503)
 *   GET  /ai/v1/models            -> upstream model list (also liveness probe)
 *   POST /ai/v1/chat/completions  -> streaming chat completion
 */

export const DEFAULT_GATEWAY_BASE_URL = '/ai/v1'

export type GatewayStatus = 'unknown' | 'disabled' | 'online' | 'offline'

export type ProviderErrorCategory =
  | 'authentication'
  | 'insufficient_balance'
  | 'model_unavailable'
  | 'model_restricted'
  | 'unsupported_capability'
  | 'rate_limit'
  | 'timeout'
  | 'provider_outage'
  | 'network'
  | 'cancelled'
  | 'unknown'

export interface GatewayProbe {
  status: GatewayStatus
  models: string[]
  latencyMs: number
  detail?: string
}

/** Normalize a configured base URL, defaulting to the same-origin gateway. */
export function gatewayBaseUrl(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return DEFAULT_GATEWAY_BASE_URL
  return raw.replace(/\/+$/, '')
}

export function gatewayUrl(path: string, base?: string | null): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${gatewayBaseUrl(base)}${suffix}`
}

export function classifyHttpStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return 'authentication'
  if (status === 402) return 'insufficient_balance'
  if (status === 404) return 'model_unavailable'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 413 || status === 415 || status === 422) return 'unsupported_capability'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'provider_outage'
  return 'unknown'
}

/**
 * Human-readable, provider-neutral message. Never mentions a provider the
 * caller is not actually using.
 */
export function describeGatewayError(status: number, detail?: string): string {
  switch (classifyHttpStatus(status)) {
    case 'authentication':
      return 'The open-model gateway rejected its upstream credential. Fix the server-side key.'
    case 'insufficient_balance':
      return 'The open-model provider has no remaining balance or quota.'
    case 'model_unavailable':
      return 'The requested model is not available on the configured endpoint.'
    case 'unsupported_capability':
      return 'The configured open model rejected this request shape or attachment.'
    case 'rate_limit':
      return 'The open-model endpoint is rate-limiting. Retry shortly.'
    case 'timeout':
      return 'The open-model endpoint timed out.'
    case 'provider_outage':
      return 'The open-model endpoint is failing. Check the GPU worker or endpoint status.'
    default:
      return detail?.trim() || `AI gateway request failed (HTTP ${status}).`
  }
}

export interface ProbeGatewayOptions {
  /** Configured base URL. Defaults to /ai/v1. */
  base?: string | null
  timeoutMs?: number
  signal?: AbortSignal
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch
}

/**
 * Probe the gateway for liveness and model discovery.
 *
 * A 503 means the deployment intentionally has no gateway configured; that is
 * reported as `disabled` (not as an error) so the app can quietly fall back to
 * its configured provider instead of showing a broken state.
 */
export async function probeGateway(options: ProbeGatewayOptions = {}): Promise<GatewayProbe> {
  const timeoutMs = options.timeoutMs ?? 6_000
  const doFetch = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const startedAt = Date.now()

  try {
    const response = await doFetch(gatewayUrl('/models', options.base), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    const latencyMs = Date.now() - startedAt

    if (response.status === 503) {
      return { status: 'disabled', models: [], latencyMs, detail: 'AI gateway is not configured on this deployment' }
    }
    if (!response.ok) {
      return { status: 'offline', models: [], latencyMs, detail: describeGatewayError(response.status) }
    }

    let models: string[] = []
    try {
      const payload = await response.json() as { data?: unknown }
      if (Array.isArray(payload?.data)) {
        models = payload.data
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return ''
            const id = (entry as { id?: unknown }).id
            return typeof id === 'string' ? id : ''
          })
          .filter((id) => id.length > 0)
      }
    } catch {
      // Model discovery is optional metadata; a healthy gateway without a
      // parseable model list is still usable.
    }

    return { status: 'online', models, latencyMs }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    if (options.signal?.aborted) {
      return { status: 'unknown', models: [], latencyMs, detail: 'Gateway check cancelled' }
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'offline', models: [], latencyMs, detail: `AI gateway timed out after ${timeoutMs}ms` }
    }
    return {
      status: 'offline',
      models: [],
      latencyMs,
      detail: error instanceof Error ? error.message : 'AI gateway unreachable',
    }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}
