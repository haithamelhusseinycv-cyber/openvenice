import { describe, expect, it } from 'vitest'
import { applyVeniceRequestPolicy, withVeniceChatParams } from './venice-policy'

describe('Venice AI request policy', () => {
  it('forces Venice stock system prompt off on chat completions', () => {
    const body = applyVeniceRequestPolicy(
      '/chat/completions',
      JSON.stringify({ model: 'venice-uncensored', messages: [], venice_parameters: { enable_web_search: 'on', include_venice_system_prompt: true } }),
    )
    expect(JSON.parse(body)).toMatchObject({
      venice_parameters: {
        enable_web_search: 'on',
        include_venice_system_prompt: false,
      },
    })
  })

  it('injects venice_parameters when the caller omitted them', () => {
    const body = applyVeniceRequestPolicy(
      '/chat/completions',
      JSON.stringify({ model: 'venice-uncensored', messages: [] }),
    )
    expect(JSON.parse(body).venice_parameters.include_venice_system_prompt).toBe(false)
  })

  it('forces safe_mode off on image generate and edit so adult output is not blurred', () => {
    const generate = JSON.parse(applyVeniceRequestPolicy('/image/generate', JSON.stringify({ prompt: 'x' })))
    const edit = JSON.parse(applyVeniceRequestPolicy('/image/edit', JSON.stringify({ prompt: 'x', safe_mode: true })))
    const multi = JSON.parse(applyVeniceRequestPolicy('/image/multi-edit', JSON.stringify({ prompt: 'x' })))
    expect(generate.safe_mode).toBe(false)
    expect(edit.safe_mode).toBe(false)
    expect(multi.safe_mode).toBe(false)
  })

  it('sets moderation low on the OpenAI-compatible image endpoint', () => {
    const body = JSON.parse(applyVeniceRequestPolicy('/images/generations', JSON.stringify({ prompt: 'x' })))
    expect(body.moderation).toBe('low')
  })

  it('does not attach image filters to unrelated endpoints', () => {
    const body = JSON.parse(applyVeniceRequestPolicy('/image/upscale', JSON.stringify({ image: 'abc', scale: 2 })))
    expect(body.safe_mode).toBeUndefined()
    expect(body.moderation).toBeUndefined()
  })

  it('leaves non-JSON bodies untouched', () => {
    expect(applyVeniceRequestPolicy('/chat/completions', 'not-json')).toBe('not-json')
  })

  it('locks include_venice_system_prompt false in withVeniceChatParams', () => {
    expect(withVeniceChatParams({ include_venice_system_prompt: true, enable_web_search: 'on' })).toEqual({
      include_venice_system_prompt: false,
      enable_web_search: 'on',
    })
  })
})
