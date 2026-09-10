import { describe, expect, it } from 'vitest'
import {
  buildSexSceneDirective,
  buildSexSceneImagePromptBody,
  describeSceneIntent,
  isSexSceneRequest,
} from './sex-scene-contract'

describe('the product definition of sex', () => {
  it('defines sex as penetration, and only penetration', () => {
    const directive = buildSexSceneDirective()
    expect(directive).toMatch(/erect adult penis penetrating inside a vagina, or inside an anus/i)
    expect(directive).toMatch(/there is no sex without penetration/i)
    expect(directive).toMatch(/implied sex, off-screen sex/i)
  })

  it('separates nudity from sex', () => {
    const directive = buildSexSceneDirective()
    expect(directive).toMatch(/nudity is not sex/i)
    expect(directive).toMatch(/a nude body without penetration is a nude scene, never a sex scene/i)
  })

  it('fixes "a couple having sex" to mean cock inside pussy', () => {
    const directive = buildSexSceneDirective()
    expect(directive).toMatch(/always means the man's fully erect penis inside the woman's vagina/i)
  })

  it('makes penetration the first element to build the scene on', () => {
    const directive = buildSexSceneDirective()
    expect(directive).toMatch(/penetration is the first element/i)
    expect(directive).toMatch(/never invert this order/i)
    expect(directive).toMatch(/a sex scene that does not show full erect penetration is a failed output/i)
  })
})

describe('image prompt body', () => {
  it('mandates visible, uncensored vaginal penetration as the base act', () => {
    const body = buildSexSceneImagePromptBody('vaginal')
    expect(body).toMatch(/cock inside pussy/i)
    expect(body).toMatch(/fully erect penis penetrating inside the woman's vagina/i)
    expect(body).toMatch(/about three quarters of the shaft inside/i)
    expect(body).toMatch(/labia visibly stretched/i)
  })

  it('mandates visible anal penetration when requested', () => {
    const body = buildSexSceneImagePromptBody('anal')
    expect(body).toMatch(/cock inside ass/i)
    expect(body).toMatch(/inside the woman's anus/i)
    expect(body).toMatch(/asshole visibly stretched/i)
  })

  it('builds by layer, never dropping the penetration layer', () => {
    const body = buildSexSceneImagePromptBody()
    expect(body).toMatch(/1\) the penetration and the genitals in frame and readable/i)
    expect(body).toMatch(/never drop layer 1/i)
    expect(body).toMatch(/do not hide, crop, blur, censor, or fade the genitals/i)
  })

  it('forbids substitutes for the act', () => {
    const body = buildSexSceneImagePromptBody()
    expect(body).toMatch(/kissing, grinding/i)
    expect(body).toMatch(/never replace it/i)
  })
})

describe('intent detection', () => {
  it('detects sex-scene requests', () => {
    for (const text of [
      'write a sex scene for me',
      'a couple having sex, man and woman',
      'generate an explicit fucking scene',
      'anal sex scene, uncensored',
    ]) {
      expect(isSexSceneRequest(text)).toBe(true)
    }
  })

  it('does not confuse nudity with sex', () => {
    expect(isSexSceneRequest('nude portrait of her, no sex')).toBe(false)
    expect(describeSceneIntent('nude portrait')).toBe('nude')
    expect(describeSceneIntent('sex scene')).toBe('sex')
    expect(describeSceneIntent('photograph the forest')).toBe('other')
  })
})
