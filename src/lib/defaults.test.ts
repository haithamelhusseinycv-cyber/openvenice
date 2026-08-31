import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  isStaleSystemPrompt,
  lockChatSystemPrompt,
} from './defaults'

describe('chat system prompt migration', () => {
  it('replaces the legacy image-writer instruction', () => {
    const legacy = 'You write copy-ready Lustify v8 prompts for this app. FRAMING IS A HARD FAIL RULE.'

    expect(isStaleSystemPrompt(legacy)).toBe(true)
    expect(lockChatSystemPrompt(legacy)).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('keeps a user-defined general chat instruction', () => {
    const custom = 'Answer directly, use concise bullet points, and ask before making assumptions.'

    expect(isStaleSystemPrompt(custom)).toBe(false)
    expect(lockChatSystemPrompt(custom)).toBe(custom)
  })

  it('defaults an empty saved instruction', () => {
    expect(lockChatSystemPrompt('')).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('explicitly prevents ordinary questions becoming image prompts', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('Do not turn an ordinary question into an image prompt')
  })
})
