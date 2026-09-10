import { describe, expect, it } from 'vitest'
import {
  hasDiscoveredModels,
  inferCapabilities,
  normalizeDiscoveredModels,
  pickOpenModelId,
  rankDiscoveredModels,
} from './open-models'

describe('inferCapabilities', () => {
  it('detects vision from the model id', () => {
    expect(inferCapabilities('qwen3-vl-30b-a3b-thinking-abliterated').supportsVision).toBe(true)
    expect(inferCapabilities('qwen2.5-vl-7b').supportsVision).toBe(true)
    expect(inferCapabilities('gemma3:12b').supportsVision).toBe(true)
  })

  it('detects reasoning from the model id', () => {
    expect(inferCapabilities('qwen3-vl-30b-a3b-thinking-abliterated').supportsReasoning).toBe(true)
    expect(inferCapabilities('deepseek-r1-distill-14b').supportsReasoning).toBe(true)
    expect(inferCapabilities('llama-3.3-70b-instruct').supportsReasoning).toBe(false)
  })

  it('never claims schema support it cannot verify', () => {
    expect(inferCapabilities('qwen3-vl-30b').supportsResponseSchema).toBe(false)
    expect(inferCapabilities('mistral-nemo-12b').supportsResponseSchema).toBe(false)
  })

  it('does not claim hosted-provider capabilities on a self-hosted endpoint', () => {
    const caps = inferCapabilities('qwen3-30b')
    expect(caps.supportsWebSearch).toBe(false)
    expect(caps.supportsE2EE).toBe(false)
    expect(caps.supportsTeeAttestation).toBe(false)
  })
})

describe('normalizeDiscoveredModels', () => {
  it('accepts OpenAI-style entries', () => {
    const models = normalizeDiscoveredModels([
      { id: 'qwen3-vl-30b', object: 'model', owned_by: 'vllm' },
      { id: 'qwen2.5-14b-instruct' },
    ])
    expect(models.map((m) => m.id)).toEqual(['qwen3-vl-30b', 'qwen2.5-14b-instruct'])
    expect(models[0].inferred).toBe(true)
  })

  it('accepts bare string ids', () => {
    expect(normalizeDiscoveredModels(['a', 'b']).map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('deduplicates, trims and drops junk without throwing', () => {
    const models = normalizeDiscoveredModels([' qwen3 ', 'qwen3', '', '   ', null, 42, { id: 'x' }])
    expect(models.map((m) => m.id)).toEqual(['qwen3', 'x'])
  })

  it('returns an empty list for a malformed payload', () => {
    expect(normalizeDiscoveredModels(undefined)).toEqual([])
    expect(normalizeDiscoveredModels({ data: [] })).toEqual([])
  })
})

describe('pickOpenModelId', () => {
  it('keeps the configured preference when the endpoint serves it', () => {
    expect(pickOpenModelId(['a', 'qwen3-vl-30b'], 'qwen3-vl-30b')).toBe('qwen3-vl-30b')
  })

  it('falls back to the first discovered model when the preference is missing', () => {
    expect(pickOpenModelId(['served-a', 'served-b'], 'qwen3-vl-30b')).toBe('served-a')
  })

  it('keeps the configured id when nothing was discovered', () => {
    expect(pickOpenModelId([], 'qwen3-vl-30b')).toBe('qwen3-vl-30b')
    expect(pickOpenModelId(['  '], 'qwen3-vl-30b')).toBe('qwen3-vl-30b')
  })

  it('reports whether a usable upstream exists', () => {
    expect(hasDiscoveredModels(['a'])).toBe(true)
    expect(hasDiscoveredModels([''])).toBe(false)
    expect(hasDiscoveredModels([])).toBe(false)
  })
})

describe('rankDiscoveredModels', () => {
  it('promotes the preferred model without dropping the others', () => {
    const models = normalizeDiscoveredModels(['a', 'b', 'c'])
    expect(rankDiscoveredModels(models, 'c').map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the order untouched when there is no preference match', () => {
    const models = normalizeDiscoveredModels(['a', 'b'])
    expect(rankDiscoveredModels(models, 'zzz').map((m) => m.id)).toEqual(['a', 'b'])
  })
})
