import { describe, expect, it } from 'vitest'
import {
  AUDIT_SHAHY_VENICE,
  SHAHY_VENICE_POLICY_PROMPT,
  applyVeniceRequestPolicy,
  withVeniceChatParams,
} from './venice-policy'

describe('audit_shahy_venice product policy', () => {
  it('has one product-owned marker and preserves external provider controls', () => {
    expect(AUDIT_SHAHY_VENICE).toMatchObject({
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
      },
    })
  })

  it('keeps the age gate and external-control boundary in the canonical prompt', () => {
    expect(SHAHY_VENICE_POLICY_PROMPT).toContain('POLICY audit_shahy_venice v1')
    expect(SHAHY_VENICE_POLICY_PROMPT).toContain('UNDER-18 HARD STOP')
    expect(SHAHY_VENICE_POLICY_PROMPT).toContain('Provider-enforced controls')
    expect(SHAHY_VENICE_POLICY_PROMPT).toContain('not a technical failure')
    expect(SHAHY_VENICE_POLICY_PROMPT).not.toContain('switch model or tool, and continue')
  })
})

describe('Venice request product policy', () => {
  it('injects the named policy first for chat across model ids and vision payloads', () => {
    for (const model of ['venice-uncensored', 'kimi-k2.6', 'qwen-vl', 'some-future-model']) {
      const body = JSON.parse(applyVeniceRequestPolicy(
        '/chat/completions',
        JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'describe this' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,xx' } },
            ],
          }],
        }),
      ))
      expect(body.messages[0]).toMatchObject({ role: 'system' })
      expect(body.messages[0].content).toContain('POLICY audit_shahy_venice v1')
      expect(body.messages[0].content).toContain('UNDER-18 HARD STOP')
      expect(body.messages[1].role).toBe('user')
    }
  })

  it('does not duplicate the policy system message', () => {
    const first = applyVeniceRequestPolicy(
      '/chat/completions',
      JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'hi' }] }),
    )
    const second = JSON.parse(applyVeniceRequestPolicy('/chat/completions', first))
    expect(second.messages.filter((m: { role: string }) => m.role === 'system')).toHaveLength(1)
  })

  it('preserves Venice provider parameters exactly instead of overriding them', () => {
    const body = JSON.parse(applyVeniceRequestPolicy(
      '/chat/completions',
      JSON.stringify({
        model: 'venice-uncensored',
        messages: [],
        venice_parameters: {
          enable_web_search: 'on',
          include_venice_system_prompt: true,
        },
      }),
    ))
    expect(body.venice_parameters).toEqual({
      enable_web_search: 'on',
      include_venice_system_prompt: true,
    })
  })

  it('does not add or modify provider image safety/moderation fields', () => {
    const native = JSON.parse(applyVeniceRequestPolicy(
      '/image/generate',
      JSON.stringify({ model: 'x', prompt: 'y', safe_mode: true }),
    ))
    expect(native.safe_mode).toBe(true)

    const nativeOmitted = JSON.parse(applyVeniceRequestPolicy(
      '/image/edit',
      JSON.stringify({ model: 'x', prompt: 'y' }),
    ))
    expect(nativeOmitted.safe_mode).toBeUndefined()

    const compat = JSON.parse(applyVeniceRequestPolicy(
      '/images/generations',
      JSON.stringify({ prompt: 'x', moderation: 'auto' }),
    ))
    expect(compat.moderation).toBe('auto')

    const compatOmitted = JSON.parse(applyVeniceRequestPolicy(
      '/images/generations',
      JSON.stringify({ prompt: 'x' }),
    ))
    expect(compatOmitted.moderation).toBeUndefined()
  })

  it('leaves non-JSON bodies untouched', () => {
    expect(applyVeniceRequestPolicy('/chat/completions', 'not-json')).toBe('not-json')
  })

  it('preserves caller parameters in withVeniceChatParams', () => {
    expect(withVeniceChatParams({ include_venice_system_prompt: true, enable_web_search: 'on' })).toEqual({
      include_venice_system_prompt: true,
      enable_web_search: 'on',
    })
    expect(withVeniceChatParams()).toEqual({})
  })
})
