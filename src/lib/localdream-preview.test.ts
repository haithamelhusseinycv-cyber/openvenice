import { describe, expect, it } from 'vitest'
import { decodeRawRgb } from './localdream-preview'

describe('Local Dream raw image preview', () => {
  it('preserves RGB colors and adds opaque alpha without altering source bytes', () => {
    const encoded = btoa(String.fromCharCode(255, 0, 0, 0, 128, 255))
    expect([...decodeRawRgb(encoded, 2, 1)]).toEqual([255, 0, 0, 255, 0, 128, 255, 255])
    expect([...decodeRawRgb(`data:application/octet-stream;base64,${encoded}`, 2, 1)]).toEqual([255, 0, 0, 255, 0, 128, 255, 255])
  })

  it('rejects truncated payloads, invalid dimensions, and a four-channel image', () => {
    for (const [encoded, width, height] of [[btoa('aa'), 1, 1], [btoa('aaaa'), 1, 1], ['', 0, 2], ['', 0.5, 1]] as const) {
      expect(() => decodeRawRgb(encoded, width, height)).toThrow('invalid raw RGB')
    }
  })
})
