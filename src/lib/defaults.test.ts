import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_CHAT_SEARCH_PARAMS,
  isStaleSystemPrompt,
  lockChatSystemPrompt,
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

  it('explicitly prevents ordinary questions becoming image prompts', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('Do not turn an ordinary question into an image prompt')
  })

  it('explicitly permits factual questions about consensual adult models and tools', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('adult-content models')
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('do not refuse merely because the subject is sexual or explicit')
  })

  it('starts new chats with Venice web search and citations enabled', () => {
    expect(DEFAULT_CHAT_SEARCH_PARAMS).toMatchObject({
      enable_web_search: 'on',
      enable_web_citations: true,
    })
  })
})
