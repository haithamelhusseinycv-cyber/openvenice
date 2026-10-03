import { describe, expect, it } from 'vitest'
import { isAllowedImageModel, isAllowedEditModel } from './allowed-models'
import { imageModelLabel } from './image-model-label'
import { shapePixels } from './image-shapes'
import type { VeniceModel } from '../types/venice'

describe('image catalogue and output shapes', () => {
  it('admits newly published uncensored models without a hardcoded ID', () => {
    expect(isAllowedImageModel('future-image-model', true)).toBe(true)
    expect(isAllowedEditModel('future-edit-model', true)).toBe(true)
    expect(isAllowedImageModel('unknown-model')).toBe(false)
  })
  it('does not advertise unconfirmed FireRed or Qwen variants as uncensored', () => {
    const model = { id: 'firered-image-edit', model_spec: { name: 'FireRed' } } as VeniceModel
    expect(imageModelLabel(model)).toBe('FireRed · Not marked uncensored')
    expect(imageModelLabel({ ...model, model_spec: { name: 'Qwen', uncensored: true } })).toBe('Qwen · Uncensored')
    expect(imageModelLabel({ ...model, model_spec: { uncensored: false, traits: ['most_uncensored'] } })).toContain('Not marked uncensored')
  })
  it('keeps the chosen orientation while satisfying pixel model divisibility', () => {
    expect(shapePixels('1:1', 1024, 16)).toEqual({ w: 1024, h: 1024 })
    expect(shapePixels('9:16', 1024, 8)).toEqual({ w: 576, h: 1024 })
    expect(shapePixels('16:9', 1024, 8)).toEqual({ w: 1024, h: 576 })
    const portrait = shapePixels('2:3', 1024, 16)
    expect(portrait.w).toBeLessThan(portrait.h)
    expect(portrait.w % 16).toBe(0)
    expect(portrait.h % 16).toBe(0)
  })
})
