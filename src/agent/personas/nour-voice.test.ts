import { describe, expect, it } from 'vitest'
import { buildNourSystemPrompt } from './nour'
import type { ChatMessage } from '../../types/venice'

function voiceMessage(content: string, locale: 'en-US' | 'ar-EG') {
  return { role: 'user', content, voice_locale: locale } as ChatMessage
}

describe('Nour voice turn rendering', () => {
  it('uses Egyptian Arabic script rendering for ar-EG speech turns', () => {
    const prompt = buildNourSystemPrompt('base', [voiceMessage('عامل ايه', 'ar-EG')])
    expect(prompt).toContain('Egyptian Arabic speech recognition (ar-EG)')
    expect(prompt).toContain('using Arabic script')
    expect(prompt).toContain('overrides the normal Franco-Arab display rule')
  })

  it('uses natural American English rendering for en-US speech turns', () => {
    const prompt = buildNourSystemPrompt('base', [voiceMessage('what is on my schedule?', 'en-US')])
    expect(prompt).toContain('English speech recognition (en-US)')
    expect(prompt).toContain('natural casual American English')
  })

  it('does not add a voice override to an ordinary typed turn', () => {
    const prompt = buildNourSystemPrompt('base', [{ role: 'user', content: 'hello' }])
    expect(prompt).not.toContain('VOICE TURN OVERRIDE')
  })
})
