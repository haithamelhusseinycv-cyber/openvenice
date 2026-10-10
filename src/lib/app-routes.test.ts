import { describe, it, expect } from 'vitest'
import { APP_ROUTES, tabForPath } from './app-routes'
describe('Chilli separate pages', () => {
  it('opens Studio from the root and resolves direct page links', () => {
    expect(tabForPath('/')).toBe('studio')
    expect(tabForPath('/studio')).toBe('studio')
    expect(tabForPath('/noor')).toBe('playground')
    expect(tabForPath('/noor/')).toBe('playground')
    expect(tabForPath('/create')).toBe('image')
  })
  it('round trips each navigation link to its own page', () => {
    for (const [tab,path] of Object.entries(APP_ROUTES)) expect(tabForPath(path)).toBe(tab)
  })
})
