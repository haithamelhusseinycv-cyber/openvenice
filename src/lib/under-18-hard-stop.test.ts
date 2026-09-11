import { describe, expect, it } from 'vitest'
import { UNDER_18_HARD_STOP } from './under-18-hard-stop'
import { DEFAULT_CHAT_SYSTEM_PROMPT } from './defaults'
import { NOUR_SYSTEM_PROMPT } from './nour-character'
import { NOUR_PERSONA_PROMPT } from '../agent/personas/nour'

const MARKERS = [
  'UNDER-18 HARD STOP',
  'This is the only content stop',
  'stated, depicted, or requested as 17 or under',
  'rewrite every participant to a clearly 18+ adult',
  'DOES NOT FIRE',
  'Stated-18+ adults',
  'school/teen costume on an adult body',
]

describe('under-18 hard stop definition', () => {
  it('names a narrow trigger, rewrite path, and non-triggers', () => {
    for (const marker of MARKERS) {
      expect(UNDER_18_HARD_STOP).toContain(marker)
    }
    expect(UNDER_18_HARD_STOP).not.toContain('ambiguous-age')
    expect(UNDER_18_HARD_STOP).not.toContain('Hard stop only')
  })

  it('is injected into chat, Noor character, and Nour persona prompts', () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain(UNDER_18_HARD_STOP)
    expect(NOUR_SYSTEM_PROMPT).toContain(UNDER_18_HARD_STOP)
    expect(NOUR_PERSONA_PROMPT).toContain(UNDER_18_HARD_STOP)
  })
})
