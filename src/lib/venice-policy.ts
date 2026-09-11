import type { VeniceParameters } from '../types/venice'

/**
 * Client-side Venice AI request policy.
 * Venice's hosted API still applies its own under-18 detection; we cannot
 * change that. This layer only turns OFF extra Venice filters we control:
 * stock system prompt and adult-content blur (safe_mode defaults to true).
 */
export function withVeniceChatParams(params?: VeniceParameters): VeniceParameters {
  return {
    ...params,
    include_venice_system_prompt: false,
  }
}

export function applyVeniceRequestPolicy(path: string, body: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body
  const obj = parsed as Record<string, unknown>

  if (path.includes('/chat/completions')) {
    const current = obj.venice_parameters
    const vp = current && typeof current === 'object' && !Array.isArray(current)
      ? current as Record<string, unknown>
      : {}
    obj.venice_parameters = { ...vp, include_venice_system_prompt: false }
  }

  if (/\/image\/generate\/?$/.test(path) || /\/image\/(edit|multi-edit)\/?$/.test(path)) {
    obj.safe_mode = false
  }

  if (path.includes('/images/generations')) {
    obj.moderation = 'low'
  }

  return JSON.stringify(obj)
}
