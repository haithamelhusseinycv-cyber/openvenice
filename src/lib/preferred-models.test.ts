import { describe, expect, it } from 'vitest'
import {
  PREFERRED_MODELS,
  freedomLabel,
  freedomTier,
  isMobileFriendly,
  isUncensoredId,
  pickId,
  preferenceRank,
  rankIds,
} from './preferred-models'

describe('uncensored detection', () => {
  it('recognises the families this repo already ships', () => {
    expect(isUncensoredId('venice-uncensored-1-2')).toBe(true)
    expect(isUncensoredId('olafangensan-glm-4.7-flash-heretic')).toBe(true)
    expect(isUncensoredId('qwen3-vl-30b-a3b-thinking-abliterated')).toBe(true)
    expect(isUncensoredId('lustify-v8')).toBe(false)
  })

  it('keeps the uncensored-first rule on the open-model route', () => {
    expect(rankIds(['qwen3-8b-instruct', 'qwen3-8b-abliterated'], 'chat')[0]).toBe('qwen3-8b-abliterated')
  })
})

describe('capability preferences', () => {
  it('covers every expressive capability the product ships', () => {
    for (const capability of ['chat', 'prompt', 'agent', 'image', 'edit', 'video', 'faceswap', 'headswap', 'bodyswap', 'tts'] as const) {
      expect(PREFERRED_MODELS[capability].length).toBeGreaterThan(0)
    }
  })

  it('ranks declared favourites in declared order', () => {
    expect(rankIds(['flux-2-max', 'lustify-v8', 'something-else'], 'image')[0]).toBe('lustify-v8')
    expect(rankIds(['qwen-3-6-plus', 'qwen-3-8-27b'], 'agent')[0]).toBe('qwen-3-8-27b')
    expect(rankIds(['flux-2-max-edit', 'qwen-edit-uncensored'], 'edit')[0]).toBe('qwen-edit-uncensored')
  })

  it('never drops a discovered model', () => {
    const ranked = rankIds(['unknown-a', 'lustify-v8', 'unknown-b'], 'image')
    expect(ranked.sort()).toEqual(['lustify-v8', 'unknown-a', 'unknown-b'])
  })

  it('falls back to uncensored models before alphabetically-sorted strangers', () => {
    expect(rankIds(['aaa-model', 'zzz-abliterated'], 'chat')[0]).toBe('zzz-abliterated')
  })

  it('deduplicates and trims', () => {
    expect(rankIds([' lustify-v8 ', 'lustify-v8', ''], 'image')).toEqual(['lustify-v8'])
  })

  it('has no opinion about an unknown id', () => {
    expect(preferenceRank('totally-unknown', 'chat')).toBeUndefined()
  })

  it('picks the head of the ranked list', () => {
    expect(pickId(['flux-dev', 'qwen-edit-uncensored'], 'edit')).toBe('qwen-edit-uncensored')
    expect(pickId([], 'edit')).toBeUndefined()
  })
})

describe('hardcoded freedom findings drive routing', () => {
  it('labels measured models as verified-high', () => {
    expect(freedomTier('venice-uncensored-1-2', 'chat')).toBe(0)
    expect(freedomTier('qwen-edit-uncensored', 'edit')).toBe(0)
    expect(freedomTier('lustify-v8', 'image')).toBe(0)
    expect(freedomLabel('venice-uncensored-1-2', 'chat')).toBe('verified-high')
  })

  it('labels abliterated lineage as assumed-high even when unknown', () => {
    expect(freedomTier('qwen3-8b-abliterated', 'chat')).toBe(1)
    expect(freedomTier('qwen3-8b-instruct', 'chat')).toBe(2)
  })

  it('prefers the freest model when ranking known entries', () => {
    expect(rankIds(['qwen-edit-uncensored', 'qwen-image-3-pro-edit'], 'edit')[0]).toBe('qwen-edit-uncensored')
  })

  it('breaks unrecognized ties toward freer unknowns before alphabetical order', () => {
    expect(rankIds(['aaa-instruct', 'zzz-abliterated'], 'chat')[0]).toBe('zzz-abliterated')
  })

  it('keeps standard models above nothing — discovery still wins membership', () => {
    const ranked = rankIds(['flux-dev', 'lustify-v8', 'nano-banana-pro'], 'image')
    expect(ranked[0]).toBe('lustify-v8')
    expect(ranked).toHaveLength(3)
  })
})

describe('mobile routing hints', () => {
  it('marks the cheap streaming models mobile-friendly', () => {
    expect(isMobileFriendly('venice-uncensored-1-2', 'chat')).toBe(true)
    expect(isMobileFriendly('qwen-3-8-27b', 'agent')).toBe(true)
    expect(isMobileFriendly('nano-banana-pro', 'image')).toBe(false)
  })

  it('prefers a mobile-friendly model when the surface is a phone', () => {
    const ranked = rankIds(['flux-dev', 'flux-2-pro'], 'image')
    expect(ranked[0]).toBe('flux-2-pro')
    expect(isMobileFriendly(ranked[0], 'image')).toBe(true)
  })
})
