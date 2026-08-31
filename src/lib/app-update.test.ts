import { describe, expect, it } from 'vitest'
import { isStaleBuildError } from './app-update'

describe('stale build recovery detection', () => {
  it('recognizes a removed Vite lazy chunk', () => {
    expect(isStaleBuildError(new TypeError(
      'Failed to fetch dynamically imported module: https://example.test/assets/image-page-old.js',
    ))).toBe(true)
  })

  it('does not treat an ordinary render error as a stale deployment', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
