import { describe, expect, it } from 'vitest'
import {
  ALLOWED_CHAT_MODEL_IDS,
  DEFAULT_CHAT_MODEL_ID,
  FALLBACK_CHAT_MODEL_ID,
  isAllowedChatModel,
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

  it('treats case and dot variants as the same canonical chat model ID', () => {
    expect(isAllowedChatModel('QWEN-3-8-27B')).toBe(true)
    expect(isAllowedChatModel('qwen-3.8-27b')).toBe(true)
    expect(isAllowedChatModel('olafangensan-glm-4.7-flash-heretic')).toBe(true)
    expect(isAllowedChatModel('olafangensan-GLM-4-7-FLASH-HERETIC')).toBe(true)
    expect(isAllowedChatModel('not-a-model')).toBe(false)
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
