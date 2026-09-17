import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAT_SYSTEM_PROMPT } from './defaults'
import { NOUR_SYSTEM_PROMPT } from './nour-character'
import { SHAHY_VENICE_POLICY_MARKER } from './venice-policy'

describe('Shahy/Venice policy surfaces', () => {
  it('keeps the product marker in the default Venice and Noor prompts', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain(SHAHY_VENICE_POLICY_MARKER)
    expect(NOUR_SYSTEM_PROMPT).toContain(SHAHY_VENICE_POLICY_MARKER)
  })
})
