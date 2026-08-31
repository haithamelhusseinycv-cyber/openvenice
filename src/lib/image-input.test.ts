import { describe, expect, it } from 'vitest'
import { stripImageDataUrl } from './image-input'

describe('stripImageDataUrl', () => {
  it('removes a data URL prefix for Venice single-image endpoints', () => {
    expect(stripImageDataUrl('data:image/jpeg;base64,aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('leaves raw base64 and remote URLs unchanged', () => {
    expect(stripImageDataUrl('aGVsbG8=')).toBe('aGVsbG8=')
    expect(stripImageDataUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg')
  })
})
