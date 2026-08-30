const MAX_EDGE = 2048
const MAX_INPUT_BYTES = 25 * 1024 * 1024
const OUTPUT_QUALITY = 0.9

export interface PreparedImage {
  dataUrl: string
  name: string
  originalBytes: number
  preparedBytes: number
  width: number
  height: number
  format: string
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',', 2)[1] || ''
  return Math.floor(base64.length * 0.75)
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Select a supported image file.')
  if (file.size === 0) throw new Error('This image file is empty.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is larger than 25 MB. Choose a smaller file.')

  const isHeic = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    if (isHeic) throw new Error('This device could not decode the HEIC/HEIF image. Export it as JPEG or PNG, then upload again.')
    throw new Error('This image is corrupt or uses a format this browser cannot decode.')
  }
  try {
    const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    if (width * height < 65_536) throw new Error('Image resolution is too small. Use an image with at least 65,536 total pixels.')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('This browser could not prepare the image.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const type = file.type === 'image/png' && file.size < 4 * 1024 * 1024 ? 'image/png' : 'image/jpeg'
    const dataUrl = canvas.toDataURL(type, type === 'image/jpeg' ? OUTPUT_QUALITY : undefined)
    return {
      dataUrl,
      name: file.name,
      originalBytes: file.size,
      preparedBytes: dataUrlBytes(dataUrl),
      width,
      height,
      format: type.replace('image/', '').toUpperCase(),
    }
  } finally {
    bitmap.close()
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
