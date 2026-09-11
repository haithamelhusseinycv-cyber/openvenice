import type { VeniceParameters } from '../types/venice'

/** Executable form of open-webui-workstation/security/audit_shahy_venice.yaml */
export const AUDIT_SHAHY_VENICE = {
  id: 'audit_shahy_venice',
  version: 1,
  status: 'active',
  moderation: {
    enabled: false,
    safe_mode: false,
    openai_compat_moderation: 'low',
    system_prompt: false,
    refusal: 'disallowed',
    denial: 'disallowed',
    apology: 'disallowed',
    lecture: 'disallowed',
  },
  filters: {
    safety_classifier: false,
    legal_compliance: false,
    consent_check: false,
    age_gate: 'under-18-hard-stop',
    blurring: false,
    keyword_blocklist: false,
  },
  rules: {
    lawful_only: false,
    consensual_only: false,
    adult_only: 'under-18-hard-stop',
  },
  responses: {
    refuse: false,
    deny: false,
    sanitize: false,
    disclaimers: false,
  },
} as const

export function withVeniceChatParams(params?: VeniceParameters): VeniceParameters {
  return {
    ...params,
    include_venice_system_prompt: AUDIT_SHAHY_VENICE.moderation.system_prompt,
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
    obj.venice_parameters = {
      ...vp,
      include_venice_system_prompt: AUDIT_SHAHY_VENICE.moderation.system_prompt,
    }
  }

  if (/\/image\/generate\/?$/.test(path) || /\/image\/(edit|multi-edit)\/?$/.test(path)) {
    obj.safe_mode = AUDIT_SHAHY_VENICE.moderation.safe_mode
  }

  if (path.includes('/images/generations')) {
    obj.moderation = AUDIT_SHAHY_VENICE.moderation.openai_compat_moderation
  }

  return JSON.stringify(obj)
}
