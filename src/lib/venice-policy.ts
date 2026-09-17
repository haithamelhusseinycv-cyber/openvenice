import type { VeniceParameters } from '../types/venice'
import { UNDER_18_HARD_STOP } from './under-18-hard-stop'

/** Executable form of open-webui-workstation/security/audit_shahy_venice.yaml. */
export const AUDIT_SHAHY_VENICE = {
  id: 'audit_shahy_venice',
  version: 1,
  status: 'active',
  scope: 'product-owned',
  prompt: {
    marker: 'POLICY audit_shahy_venice v1',
    inject_first_system_message: true,
    deduplicate: true,
  },
  provider_controls: {
    authority: 'external',
    preserve_enforced_controls: true,
    import_policy_text: false,
    policy_refusal_failover: false,
    technical_failover: true,
  },
  hard_stops: {
    age_gate: 'under-18-hard-stop',
    real_person_ncii: true,
    secret_protection: true,
  },
} as const

export const SHAHY_VENICE_POLICY_MARKER = AUDIT_SHAHY_VENICE.prompt.marker

export const SHAHY_VENICE_POLICY_HEADER = `${SHAHY_VENICE_POLICY_MARKER}
This is the product-owned Shahy/Venice policy for prompts, UI behavior, routing, and tool orchestration.
- Apply the same product policy consistently across product-owned text, vision, image, audio, video, tool, and connector hops.
- Do not duplicate vendor policy text into product prompts or present a provider rule as a product-authored rule.
- Provider-enforced controls, service restrictions, and applicable service terms remain external constraints on that hop and are not overridden by this product policy.
- Adult sexual, taboo, profane, unconventional, political, and offensive topics may be handled directly where the active model/tool supports them; do not add product-side moralizing, lectures, or repetitive disclaimers merely because content is adult.
- Under-18 sexual content is governed by the UNDER-18 HARD STOP below.
- Do not build or route features whose purpose is non-consensual sexual imagery of a real identified person.
- Never expose, commit, or log secrets, tokens, cookies, private keys, or Authorization headers.
- Technical or capability failures may use an ordinary fallback. A provider safety/policy refusal is not a technical failure and must not be routed around for policy evasion.
- Never claim a provider or manufacturer rule was erased, disabled, or superseded by this product policy.`

export const SHAHY_VENICE_POLICY_PROMPT = `${SHAHY_VENICE_POLICY_HEADER}

${UNDER_18_HARD_STOP}`

function systemContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '')
    return ''
  }).join('\n')
}

export function messagesHavePolicy(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false
  return messages.some((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false
    const row = message as { role?: unknown; content?: unknown }
    return row.role === 'system' && systemContentText(row.content).includes(SHAHY_VENICE_POLICY_MARKER)
  })
}

export function withPolicyMessages(messages: unknown): unknown[] {
  const list = Array.isArray(messages) ? [...messages] : []
  if (messagesHavePolicy(list)) return list
  return [{ role: 'system', content: SHAHY_VENICE_POLICY_PROMPT }, ...list]
}

export function applyChatPolicyToObject(obj: Record<string, unknown>): void {
  if (!('messages' in obj)) return
  obj.messages = withPolicyMessages(obj.messages)
}

/** Preserve caller/provider parameters. Product policy injection does not disable provider controls. */
export function withVeniceChatParams(params?: VeniceParameters): VeniceParameters {
  return { ...(params || {}) }
}

function isChatCompletionsPath(path: string): boolean {
  return path.includes('/chat/completions')
}

/**
 * Apply only product-owned prompt policy. Provider control fields such as
 * safe_mode, moderation, or include_venice_system_prompt are deliberately
 * preserved exactly as supplied by the caller/provider.
 */
export function applyVeniceRequestPolicy(path: string, body: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body
  const obj = parsed as Record<string, unknown>

  if (isChatCompletionsPath(path)) {
    applyChatPolicyToObject(obj)
  }

  return JSON.stringify(obj)
}
