import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  isStaleSystemPrompt,
  lockChatSystemPrompt,
} from './defaults'

describe('chat system prompt migration', () => {
  it('replaces the legacy image-prompt-writer chat instruction', () => {
    const legacy = 'You write copy-ready Lustify v8 prompts for this app. FRAMING IS A HARD FAIL RULE.'

    expect(isStaleSystemPrompt(legacy)).toBe(true)
    expect(lockChatSystemPrompt(legacy)).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
  })

  it('preserves a legitimate custom conversational system prompt', () => {
    const custom = 'Be concise and answer the user directly.'

    expect(isStaleSystemPrompt(custom)).toBe(false)
    expect(lockChatSystemPrompt(custom)).toBe(custom)
  })

  it('uses the conversational default when no prompt is stored', () => {
    expect(lockChatSystemPrompt('')).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('general-purpose conversational AI assistant')
  })
})
