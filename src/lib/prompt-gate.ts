import { isCouplePrompt } from './defaults'

export const PROMPT_PASS_SCORE = 90

export type PromptCheck = {
  id: string
  label: string
  ok: boolean
}

export type PromptGate = {
  score: number
  pass: boolean
  checks: PromptCheck[]
  missing: string[]
}

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w))
}

export function scoreImagePrompt(prompt?: string): PromptGate {
  const t = (prompt || '').trim().toLowerCase()
  const couple = isCouplePrompt(t)

  const checks: PromptCheck[] = [
    {
      id: 'adult',
      label: 'Adults 18+',
      ok: hasAny(t, ['18+', 'adults 18', 'adult 18']),
    },
    {
      id: 'amateur',
      label: 'Amateur iPhone still',
      ok: hasAny(t, ['amateur', 'iphone']),
    },
    {
      id: 'frame',
      label: couple ? 'Landscape full body couple' : 'Tall portrait solo torso',
      ok: couple
        ? hasAny(t, ['landscape']) && hasAny(t, ['head to toe', 'full body', 'full bodies'])
        : hasAny(t, ['tall portrait', 'portrait 2:3', 'solo torso']),
    },
    {
      id: 'hairdo',
      label: 'Hairdos in frame',
      ok: hasAny(t, ['hairdo', 'hair dos', 'visible hair']),
    },
    {
      id: 'faces',
      label: couple ? 'Both faces toward camera ~78%' : 'Face toward camera',
      ok: hasAny(t, ['looking toward the camera', 'looking at the camera', '78']),
    },
    {
      id: 'eyes',
      label: 'Alive eyes',
      ok: hasAny(t, ['alive eyes', 'catchlight', 'living eyes']),
    },
    {
      id: 'skin',
      label: 'Matte imperfect skin',
      ok: hasAny(t, ['matte']) && hasAny(t, ['pores', 'uneven', 'imperfect']),
    },
    {
      id: 'beard',
      label: 'Male facial hair',
      ok: !couple && !t.includes('1boy') && !t.includes('man:')
        ? true
        : hasAny(t, ['beard', 'stubble']),
    },
    {
      id: 'nipples',
      label: 'Visible nipples',
      ok: !t.includes('woman') && !t.includes('1girl')
        ? true
        : hasAny(t, ['nipple', 'areola']),
    },
    {
      id: 'pubic',
      label: 'Pussy hair',
      ok: !couple && !t.includes('1girl') && !t.includes('pussy')
        ? true
        : hasAny(t, ['pubic hair', 'trimmed bush', 'natural bush']),
    },
    {
      id: 'nails',
      label: 'Painted nails',
      ok: !t.includes('1girl') && !t.includes('woman')
        ? true
        : hasAny(t, ['fingernail', 'toenail', 'nail polish', 'painted nail']),
    },
    {
      id: 'sex',
      label: couple ? 'Readable penetration' : 'Torso crop not full-body solo',
      ok: couple
        ? hasAny(t, ['penetration', 'cock inside', 'inside pussy'])
        : !hasAny(t, ['head to toe', 'full body solo']),
    },
  ]

  const passed = checks.filter((c) => c.ok).length
  const score = Math.round((passed / checks.length) * 100)
  return {
    score,
    pass: score >= PROMPT_PASS_SCORE,
    checks,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  }
}
