import { describe, expect, it } from 'vitest'
import {
  ALLOWED_CHAT_MODEL_IDS,
  DEFAULT_CHAT_MODEL_ID,
  FALLBACK_CHAT_MODEL_ID,
} from './allowed-models'
import { ALLOWED_AGENT_MODELS } from '../hooks/use-agent-models'
import { DEFAULT_AGENT_MODEL, FALLBACK_AGENT_MODEL } from './playground-agent'
import { shouldUseModelFallback } from './model-routing'

describe('preferred Qwen routing', () => {
  it('uses Qwen 3.8 first and Qwen 3.6 second in Chat and Noor', () => {
    expect(ALLOWED_CHAT_MODEL_IDS.slice(0, 2)).toEqual(['qwen-3-8-27b', 'qwen-3-6-plus'])
    expect(ALLOWED_AGENT_MODELS.slice(0, 2)).toEqual(['qwen-3-8-27b', 'qwen-3-6-plus'])
    expect(DEFAULT_CHAT_MODEL_ID).toBe('qwen-3-8-27b')
    expect(FALLBACK_CHAT_MODEL_ID).toBe('qwen-3-6-plus')
    expect(DEFAULT_AGENT_MODEL).toBe('qwen-3-8-27b')
    expect(FALLBACK_AGENT_MODEL).toBe('qwen-3-6-plus')
  })

  it('keeps every Noor model reachable through the shared text-model filter', () => {
    expect(ALLOWED_AGENT_MODELS.every((model) => ALLOWED_CHAT_MODEL_IDS.includes(model as typeof ALLOWED_CHAT_MODEL_IDS[number]))).toBe(true)
  })

  it('falls back for busy/unavailable models but not auth, credit, abort, or partial output', () => {
    expect(shouldUseModelFallback({ status: 503 })).toBe(true)
    expect(shouldUseModelFallback({ status: 429 })).toBe(true)
    expect(shouldUseModelFallback({ status: 401 })).toBe(false)
    expect(shouldUseModelFallback({ status: 402 })).toBe(false)
    expect(shouldUseModelFallback({ status: 503 }, { aborted: true })).toBe(false)
    expect(shouldUseModelFallback({ status: 503 }, { hasOutput: true })).toBe(false)
  })
})
