import { describe, expect, it } from 'vitest'
import appHtml from '../../index.html?raw'

describe('Local Dream browser connection policy', () => {
  it('allows exactly the supervised loopback bridge ports without opening arbitrary HTTP origins', () => {
    const directive = appHtml.match(/connect-src ([^;]+);/)?.[1]
    expect(directive).toBeDefined()
    const sources = directive!.split(/\s+/)
    expect(sources.filter((source) => source.startsWith('http:'))).toEqual([
      'http://127.0.0.1:8807', 'http://127.0.0.1:8806', 'http://127.0.0.1:8810', 'http://127.0.0.1:8298',
    ])
    expect(sources).not.toContain('*')
    expect(sources).not.toContain('http:')
    expect(appHtml).toContain("script-src 'self';")
  })
})
