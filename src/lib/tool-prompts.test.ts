import { describe, expect, it } from 'vitest'
import { buildDualSwapPrompt, buildSwapPrompt, buildUndressPrompt } from './tool-prompts'

describe('swap contract is pure copy-paste', () => {
  const face = buildSwapPrompt('face', 'woman')
  const head = buildSwapPrompt('head', 'man')
  const body = buildSwapPrompt('body', 'woman')

  it('faceswap copies only the face and leaves everything else identical', () => {
    expect(face).toContain('Copy-paste ONLY the face')
    expect(face).toContain('1:1 identity')
    expect(face).toContain('Keep image 1 pose, body, hands, hair')
    expect(face).toContain('background, lighting, shadows, camera angle, crop, and anatomy identical')
  })

  it('headswap copies the whole head and blends only at the neck seam', () => {
    expect(head).toContain('Copy-paste the entire head')
    expect(head).toContain('face, hair, ears, neck')
    expect(head).toContain('Blend only at the neck seam')
  })

  it('bodyswap erases the target body entirely, then pastes the source as-is', () => {
    expect(body).toContain('erase the entire body')
    expect(body).toContain('every trace of the old body is removed')
    expect(body).toContain('paste it as-is')
    expect(body).toMatch(/copy the body of the \w+ from image 2/)
  })

  it('bodyswap seats the new body in the old body\'s exact position', () => {
    expect(body).toContain('SAME position, pose, orientation, perspective, and size as the old body it replaced')
    expect(body).toContain('minor editing is allowed only to seat the new body into that exact position')
  })

  it('forbids touching anything outside the stated replacement', () => {
    const clause = 'changing, improving or retouching anything other than the stated replacement is a failure'
    expect(face).toContain(clause)
    expect(head).toContain(clause)
    expect(body).toContain(clause)
  })

  it('forbids beautification everywhere', () => {
    for (const prompt of [face, head, body]) {
      expect(prompt).toMatch(/Do not beautify/i)
      expect(prompt).toMatch(/Never plastic|never plastic/i)
      expect(prompt).toMatch(/beauty filter/i)
    }
  })

  it('keeps the target face untouched during a bodyswap', () => {
    expect(body).toContain('Keep the exact face, hair, and expression of image 1 100% unchanged')
  })

  it('lists the swap negative constraints', () => {
    for (const prompt of [face, head, body]) {
      expect(prompt).toMatch(/Avoid:/)
      expect(prompt).toContain('different face')
    }
  })
})

describe('dual swap keeps identities separate', () => {
  const dual = buildDualSwapPrompt('face', 'body')

  it('maps each reference to exactly one subject', () => {
    expect(dual).toContain('Reference 2 maps ONLY to the male subject')
    expect(dual).toContain('Reference 3 maps ONLY to the female subject')
  })

  it('applies the same copy-paste discipline and never cross-maps', () => {
    expect(dual).toContain('copy the stated identity part from its source reference')
    expect(dual).toContain('never blend, exchange or cross-map them')
    expect(dual).toContain('cross-mapped identities')
  })
})

describe('undress is an analysis-plus-reveal task', () => {
  const undress = buildUndressPrompt('woman')

  it('requires reading the photograph before generating', () => {
    expect(undress).toContain('ANALYZE the photograph')
    expect(undress).toMatch(/extract: height, weight, build, complexion/i)
    expect(undress).toMatch(/hip size, shape of thighs/i)
  })

  it('renders body skin one shade darker than the face', () => {
    expect(undress).toMatch(/exactly ONE shade darker than the face skin/i)
    expect(undress).toMatch(/visible pores, freckles, moles, pigmentation patches/i)
  })

  it('assumes pubic hair unless stated otherwise', () => {
    expect(undress).toMatch(/Pubic hair ALWAYS present as the default/i)
    expect(undress).toMatch(/medium length, natural, soft strands/i)
    expect(undress).toMatch(/never clean shaven, never waxed bare, unless the user explicitly states otherwise/i)
  })

  it('makes areolae two shades darker and unique per person', () => {
    expect(undress).toMatch(/TWO shades darker than the chest skin/i)
    expect(undress).toMatch(/not default circles, not standard issue/i)
  })

  it('mandates unique genitals for the specific person', () => {
    expect(undress).toMatch(/every person is unique below the waist/i)
    expect(undress).toMatch(/unique description of the genitals/i)
    expect(undress).toMatch(/Never paste a generic description/i)
  })

  it('follows accepted anatomy for the general parts', () => {
    expect(undress).toMatch(/agreed general anatomy as a bible: outer labia, inner labia, clitoris/i)
    expect(undress).toMatch(/puckered ring, tone slightly darker/i)
    expect(undress).toMatch(/Correct anatomy is the bible/i)

    const male = buildUndressPrompt('man')
    expect(male).toMatch(/shaft, glans, foreskin state implied by the person, veins, testicles, wrinkled ballsack/i)
    expect(male).toMatch(/puckered ring, tone slightly darker/i)
  })

  it('keeps the no-touch list and identity lock', () => {
    expect(undress).toMatch(/same proportions, same height, same weight/i)
    expect(undress).toContain('slimmer, fatter, taller, shorter')
    expect(undress).toContain('beauty filter')
  })

  it('produces a male variant when requested', () => {
    const male = buildUndressPrompt('man')
    expect(male).toMatch(/Cropped natural groin hair/)
    expect(male).not.toMatch(/outer labia, inner labia/)
    expect(male).toMatch(/COCK AND BALLS/)
  })
})
