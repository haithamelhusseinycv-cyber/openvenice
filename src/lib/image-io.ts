const MAX_MULTI_EDIT_BYTES = 25 * 1024 * 1024
const MAX_PIXELS = 16_777_216
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export class ImageInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageInputError'
  }
}

export function extensionForImageSrc(src: string): 'png' | 'jpg' | 'webp' {
  const value = src.trim()
  if (value.startsWith('data:image/jpeg') || value.startsWith('/9j/') || value.includes('image/jpeg')) return 'jpg'
  if (value.startsWith('data:image/webp') || value.startsWith('UklGR') || value.includes('image/webp')) return 'webp'
  return 'png'
}

export function extensionForBlob(blob: Blob): 'png' | 'jpg' | 'webp' {
  if (blob.type.includes('jpeg')) return 'jpg'
  if (blob.type.includes('webp')) return 'webp'
  return 'png'
}

export async function validateImageFile(file: File): Promise<void> {
  if (!file.type || (!ALLOWED_TYPES.has(file.type) && !file.type.startsWith('image/'))) {
    throw new ImageInputError('Use a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_MULTI_EDIT_BYTES) {
    throw new ImageInputError('Each image must be under 25 MB.')
  }
}

export async function validateImageDataUrl(dataUrl: string): Promise<void> {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const approxBytes = Math.ceil((payload.length * 3) / 4)
  if (approxBytes > MAX_MULTI_EDIT_BYTES) {
    throw new ImageInputError('Each image must be under 25 MB.')
  }
  if (typeof createImageBitmap === 'function') {
    const blob = await fetch(dataUrl.startsWith('data:') ? dataUrl : `data:${header || 'image/png'};base64,${payload}`).then((r) => r.blob())
    const bitmap = await createImageBitmap(blob)
    const pixels = bitmap.width * bitmap.height
    bitmap.close()
    if (pixels > MAX_PIXELS) {
      throw new ImageInputError('Image is too large in pixels for Venice Multi-Edit.')
    }
  }
}
