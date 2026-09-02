import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../types/venice'
import { buildNourMemoryBlock, retrieveNourMemory } from './nour-memory'

function user(content: string): ChatMessage {
  return { role: 'user', content }
}

describe('Nour persona memory', () => {
  it('always includes stable identity and language memory', () => {
    const ids = retrieveNourMemory([user('hello')]).map((card) => card.id)
    expect(ids).toContain('identity')
    expect(ids).toContain('language')
  })

  it('retrieves technical conversation discipline for build work', () => {
    const ids = retrieveNourMemory([user('check the GitHub build and API settings')]).map((card) => card.id)
    expect(ids).toContain('conversation-mode')
  })

  it('retrieves Cairo background when Egypt is relevant', () => {
    const ids = retrieveNourMemory([user('tell me about your Cairo home and the Nile')]).map((card) => card.id)
    expect(ids).toContain('cairo-life')
  })

  it('keeps contextual cards bounded', () => {
    const cards = retrieveNourMemory([
      user('Nour, tell me about Cairo, our relationship, work, money, and a flirty date'),
    ], 2)
    const contextual = cards.filter((card) => !card.always)
    expect(contextual).toHaveLength(2)
  })

  it('builds a hidden extended-memory block', () => {
    const block = buildNourMemoryBlock([user('help me code the build')])
    expect(block).toContain('NOUR EXTENDED MEMORY')
    expect(block).toContain('[identity]')
    expect(block).toContain('[conversation-mode]')
  })
})
