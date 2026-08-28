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
  const type = blob.type.toLowerCase()
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  return 'png'
}

function base64Bytes(payload: string): number {
  const clean = payload.replace(/\s/g, '')
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

async function validatePixelCount(blob: Blob): Promise<void> {
  if (typeof createImageBitmap !== 'function') return
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    if (bitmap.width * bitmap.height > MAX_PIXELS) {
      throw new ImageInputError('Image is too large in pixels for Venice Multi-Edit.')
    }
  } catch (err) {
    if (err instanceof ImageInputError) throw err
    throw new ImageInputError('Could not decode that image. Use a valid JPEG, PNG, WebP, or GIF file.')
  } finally {
    bitmap?.close()
  }
}

export async function validateImageFile(file: File): Promise<void> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ImageInputError('Use a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_MULTI_EDIT_BYTES) {
    throw new ImageInputError('Each image must be under 25 MB.')
  }
  await validatePixelCount(file)
}

export async function validateImageDataUrl(dataUrl: string): Promise<void> {
  const value = dataUrl.trim()
  const comma = value.indexOf(',')
  const isDataUrl = value.startsWith('data:') && comma >= 0
  const header = isDataUrl ? value.slice(5, comma) : ''
  const payload = comma >= 0 ? value.slice(comma + 1) : value

  if (isDataUrl) {
    const mime = header.split(';')[0].toLowerCase()
    if (!ALLOWED_TYPES.has(mime)) {
      throw new ImageInputError('Use a JPEG, PNG, WebP, or GIF image.')
    }
  }

  if (base64Bytes(payload) > MAX_MULTI_EDIT_BYTES) {
    throw new ImageInputError('Each image must be under 25 MB.')
  }

  const source = isDataUrl ? value : `data:image/png;base64,${payload}`
  let blob: Blob
  try {
    blob = await fetch(source).then((response) => response.blob())
  } catch {
    throw new ImageInputError('Could not decode that image.')
  }
  await validatePixelCount(blob)
}
