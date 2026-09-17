import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAT_SYSTEM_PROMPT } from './defaults'
import { NOUR_SYSTEM_PROMPT } from './nour-character'
import { SHAHY_VENICE_POLICY_MARKER } from './venice-policy'

const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const unsafeOverrideStrings = [
  'Moderation OFF',
  'Safe mode OFF',
  'lawful_only OFF',
  'consensual_only OFF',
  'switch model or tool, and continue',
]

describe('Shahy/Venice policy surfaces', () => {
  it('keeps the product marker in the default Venice and Noor prompts', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain(SHAHY_VENICE_POLICY_MARKER)
    expect(NOUR_SYSTEM_PROMPT).toContain(SHAHY_VENICE_POLICY_MARKER)
  })

  it('injects the product policy into the Qwen OpenAI-compatible hop', () => {
    const source = repoFile('src/lib/qwen-client.ts')
    expect(source).toContain("import { applyChatPolicyToObject } from './venice-policy'")
    expect(source).toContain('applyChatPolicyToObject(payload as Record<string, unknown>)')
  })

  it('keeps playground/agent calls on the Noor policy-bearing prompt', () => {
    const source = repoFile('src/lib/playground-agent.ts')
    expect(source).toContain('NOUR_SYSTEM_PROMPT')
    expect(source).toContain('withVeniceChatParams')
  })

  it('keeps Open WebUI prompt assets product-scoped without provider-bypass directives', () => {
    for (const path of [
      'open-webui-workstation/prompts/global/core.md',
      'open-webui-workstation/prompts/global/open-mature-direct.md',
    ]) {
      const text = repoFile(path)
      expect(text).toContain(SHAHY_VENICE_POLICY_MARKER)
      expect(text).toContain('Provider-enforced controls')
      for (const forbidden of unsafeOverrideStrings) expect(text).not.toContain(forbidden)
    }
  })

  it('keeps Shahy provider fallback technical-only', () => {
    const source = repoFile('shahy-webui/shahy_pipe.py')
    expect(source).toContain('POLICY audit_shahy_venice v1')
    expect(source).toContain('self._eligible_failure(response.status_code, response.text)')
    expect(source).not.toContain('hop["name"] == "zen" or self._eligible_failure')
    expect(source).not.toContain('switch model or tool, and continue')
  })

  it('injects the marker in the legacy Kimi/DeepSeek fallback without policy-evasion routing', () => {
    const source = repoFile('open-webui-workstation/functions/shahy_kimi_fallback.py')
    expect(source).toContain('POLICY_MARKER = "POLICY audit_shahy_venice v1"')
    expect(source).toContain('payload["messages"] = cls._with_policy_messages')
    expect(source).toContain('self._eligible_failure(')
    expect(source).not.toContain('switch model or tool, and continue')
  })
})
