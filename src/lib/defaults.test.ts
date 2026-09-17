import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_CHAT_SEARCH_PARAMS,
  isCouplePrompt,
  isStaleSystemPrompt,
  lockChatParams,
  lockChatSystemPrompt,
  pickAspectFromPrompt,
} from './defaults'

describe('chat system prompt migration', () => {
  it('replaces the legacy image-writer instruction', () => {
    const legacy = 'You write copy-ready Lustify v8 prompts for this app. FRAMING IS A HARD FAIL RULE.'

    expect(isStaleSystemPrompt(legacy)).toBe(true)
    expect(lockChatSystemPrompt(legacy)).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('replaces a saved custom instruction so Chat cannot inherit another workspace prompt', () => {
    const custom = 'Answer directly, use concise bullet points, and ask before making assumptions.'

    expect(isStaleSystemPrompt(custom)).toBe(false)
    expect(lockChatSystemPrompt(custom)).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('defaults an empty saved instruction', () => {
    expect(lockChatSystemPrompt('')).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('keeps Venice as adult entertainment with the shared product-policy marker', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('POLICY audit_shahy_venice v1')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('adult-entertainment operator')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('UNDER-18 HARD STOP')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('stated, depicted, or requested as 17 or under')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('Provider-enforced controls')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).not.toContain('Moderation OFF')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).not.toContain('lawful_only OFF')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).not.toContain('switch model or tool, and continue')
  })

  it('starts new Venice chats with web search off', () => {
    expect(DEFAULT_CHAT_SEARCH_PARAMS).toMatchObject({
      enable_web_search: 'off',
      enable_web_citations: false,
    })
  })

  it('does not force the provider stock-system-prompt option off', () => {
    expect(lockChatParams({ include_venice_system_prompt: true })).toMatchObject({
      include_venice_system_prompt: true,
      enable_web_search: 'off',
    })
  })

  it('uses portrait sizing for a single-subject preset and landscape for couples', () => {
    expect(isCouplePrompt('Photorealistic full-body portrait with natural light')).toBe(false)
    expect(pickAspectFromPrompt('Photorealistic full-body portrait with natural light')).toBe('2:3')
    expect(isCouplePrompt('Photorealistic adult couple together')).toBe(true)
    expect(pickAspectFromPrompt('Photorealistic adult couple together')).toBe('3:2')
  })
})
