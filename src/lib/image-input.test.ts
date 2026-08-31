import { describe, expect, it } from 'vitest'
import { isImageSizeAllowed, MAX_INPUT_BYTES, MAX_PREPARED_BYTES, stripImageDataUrl } from './image-input'

describe('stripImageDataUrl', () => {
  it('removes a data URL prefix for Venice single-image endpoints', () => {
    expect(stripImageDataUrl('data:image/jpeg;base64,aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('leaves raw base64 and remote URLs unchanged', () => {
    expect(stripImageDataUrl('aGVsbG8=')).toBe('aGVsbG8=')
    expect(stripImageDataUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg')
  })
})

describe('large image safety limits', () => {
  it('accepts a 20 MB original but rejects anything above 25 MB', () => {
    expect(isImageSizeAllowed(20 * 1024 * 1024)).toBe(true)
    expect(isImageSizeAllowed(MAX_INPUT_BYTES)).toBe(true)
    expect(isImageSizeAllowed(MAX_INPUT_BYTES + 1)).toBe(false)
  })

  it('caps the prepared working-copy target below one megabyte', () => {
    expect(MAX_PREPARED_BYTES).toBe(900_000)
  })
})
