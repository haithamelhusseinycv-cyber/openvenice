import { describe, expect, it } from 'vitest'
import { pruneOversized } from './safe-storage'

describe('pruneOversized', () => {
  it('retains the newest half of newest-first persisted collections', () => {
    const conversations = Array.from({ length: 10 }, (_, index) => ({ id: `newest-${index}` }))
    const result = pruneOversized(JSON.stringify({
      state: { conversations, activeConversationId: 'newest-0' },
      version: 1,
    }))
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!) as { state: { conversations: Array<{ id: string }> } }
    expect(parsed.state.conversations.map((item) => item.id)).toEqual([
      'newest-0', 'newest-1', 'newest-2', 'newest-3', 'newest-4',
    ])
  })

  it('does not rewrite small or invalid payloads', () => {
    expect(pruneOversized(JSON.stringify({ state: { messages: [1, 2, 3] } }))).toBeNull()
    expect(pruneOversized('not-json')).toBeNull()
  })

  it('prunes every supported oversized collection without touching other state', () => {
    const values = Array.from({ length: 12 }, (_, index) => index)
    const result = pruneOversized(JSON.stringify({
      state: { conversations: values, workflows: values, messages: values, setting: 'kept' },
      version: 4,
    }))
    const parsed = JSON.parse(result!) as { state: Record<string, unknown[]> & { setting: string } }
    expect(parsed.state.conversations).toEqual([0, 1, 2, 3, 4, 5])
    expect(parsed.state.workflows).toEqual([0, 1, 2, 3, 4, 5])
    expect(parsed.state.messages).toEqual([0, 1, 2, 3, 4, 5])
    expect(parsed.state.setting).toBe('kept')
  })
})
