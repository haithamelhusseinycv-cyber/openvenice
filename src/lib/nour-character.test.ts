import { describe, expect, it } from 'vitest'
import { NOUR_SYSTEM_PROMPT, nourRequestProfile, prepareNourSpeechText, splitNourSpeechText } from './nour-character'

describe('Noor adult technical mode', () => {
  it('preserves direct adult prompt-writing without interruptive boundary boilerplate', () => {
    expect(NOUR_SYSTEM_PROMPT).toContain('extensive, copy-ready prompts')
    expect(NOUR_SYSTEM_PROMPT).toContain('Local Dream')
    expect(NOUR_SYSTEM_PROMPT).toContain('consenting adults or fictional subjects')
    expect(NOUR_SYSTEM_PROMPT).toContain('adult, fictional, and consensual by default')
    expect(NOUR_SYSTEM_PROMPT).toContain('Do not inject warnings, disclaimers, policy language, moralizing')
    expect(NOUR_SYSTEM_PROMPT).not.toContain('Accuracy and authorization remain mandatory')
    expect(NOUR_SYSTEM_PROMPT).toContain('do not force a workflow')
  })

  it('uses high creativity and a larger output allowance for copy-ready prompts', () => {
    expect(nourRequestProfile('Write an extensive prompt for editing this photo')).toEqual({
      mode: 'creative-prompt',
      temperature: 0.9,
      maxCompletionTokens: 8192,
    })
  })

  it('keeps technical advice and tool execution precise', () => {
    expect(nourRequestProfile('Analyze these Local Dream sampler and CFG settings')).toMatchObject({
      mode: 'technical',
      temperature: 0.5,
    })
    expect(nourRequestProfile('Build an image workflow on the canvas')).toEqual({
      mode: 'tool',
      temperature: 0.4,
      maxCompletionTokens: 4096,
    })
  })

  it('uses a balanced profile for ordinary conversation', () => {
    expect(nourRequestProfile('Tell me what you think about this idea')).toEqual({
      mode: 'conversation',
      temperature: 0.7,
      maxCompletionTokens: 4096,
    })
  })

  it('removes visual-only markdown before speech', () => {
    expect(prepareNourSpeechText('## Result\nRead [the guide](https://example.test) and `retry`.'))
      .toBe('Result Read the guide and retry.')
  })

  it('chunks long replies without truncating their spoken content', () => {
    const input = `${'First sentence has useful detail. '.repeat(12)}${'Final sentence must be spoken. '.repeat(12)}`
    const prepared = prepareNourSpeechText(input)
    const chunks = splitNourSpeechText(input, 120, 180)

    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks[0].length).toBeLessThanOrEqual(120)
    expect(chunks.slice(1).every((chunk) => chunk.length <= 180)).toBe(true)
    expect(chunks.join(' ')).toBe(prepared)
    expect(chunks.at(-1)).toContain('Final sentence must be spoken.')
  })
})
