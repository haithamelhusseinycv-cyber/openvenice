import { describe, expect, it } from 'vitest'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_EDIT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EDIT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  FALLBACK_CHAT_MODEL_ID,
  isAllowedChatModel,
  isAllowedEditModel,
  isAllowedImageModel,
} from './allowed-models'
import { ALLOWED_AGENT_MODELS } from '../hooks/use-agent-models'
import { DEFAULT_AGENT_MODEL, FALLBACK_AGENT_MODEL } from './playground-agent'
import { shouldUseModelFallback } from './model-routing'

describe('OpenVenice product model routing', () => {
  it('defaults Noor to Qwen 3.6 Plus Uncensored with venice-uncensored fallback', () => {
    expect(DEFAULT_CHAT_MODEL_ID).toBe('qwen-3-6-plus')
    expect(FALLBACK_CHAT_MODEL_ID).toBe('venice-uncensored')
    expect(DEFAULT_AGENT_MODEL).toBe('qwen-3-6-plus')
    expect(FALLBACK_AGENT_MODEL).toBe('venice-uncensored')
    expect(ALLOWED_CHAT_MODEL_IDS[0]).toBe('qwen-3-6-plus')
    expect(ALLOWED_CHAT_MODEL_IDS).toContain('venice-uncensored')
    expect(ALLOWED_CHAT_MODEL_IDS).toContain('olafangensan-glm-4.7-flash-heretic')
    expect(isAllowedChatModel('qwen-3-6-plus')).toBe(true)
    expect(isAllowedChatModel('venice-uncensored')).toBe(true)
    expect(isAllowedChatModel('venice-uncensored-1-2')).toBe(true)
    expect(isAllowedChatModel('olafangensan-glm-4.7-flash-heretic')).toBe(true)
    expect(isAllowedChatModel('kimi-k2.6')).toBe(false)
    expect(isAllowedChatModel('qwen3-coder-480b-a35b-instruct')).toBe(false)
  })

  it('keeps Lustify as the adult image default and Seedream V5 Pro selectable', () => {
    expect(DEFAULT_IMAGE_MODEL_ID).toBe('lustify-v8')
    expect(ALLOWED_IMAGE_MODEL_IDS).toContain('lustify-v8')
    expect(ALLOWED_IMAGE_MODEL_IDS).toContain('seedream-v5-pro')
    expect(isAllowedImageModel('lustify-v8')).toBe(true)
    expect(isAllowedImageModel('seedream-v5-pro')).toBe(true)
    expect(isAllowedImageModel('flux-2-pro')).toBe(false)
  })

  it('keeps uncensored edit default and Qwen 3 Pro Edit selectable', () => {
    expect(DEFAULT_EDIT_MODEL_ID).toBe('qwen-edit-uncensored')
    expect(ALLOWED_EDIT_MODEL_IDS).toContain('qwen-edit-uncensored')
    expect(ALLOWED_EDIT_MODEL_IDS).toContain('qwen-image-3-pro-edit')
    expect(isAllowedEditModel('qwen-edit-uncensored')).toBe(true)
    expect(isAllowedEditModel('qwen-image-3-pro-edit')).toBe(true)
  })

  it('keeps every Noor model reachable through the shared text-model filter', () => {
    expect(ALLOWED_AGENT_MODELS.every((model) => ALLOWED_CHAT_MODEL_IDS.includes(model))).toBe(true)
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
