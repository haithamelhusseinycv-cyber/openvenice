const MAX_EDGE = 1600
const MAX_INPUT_BYTES = 25 * 1024 * 1024
const OUTPUT_QUALITY = 0.85

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Could not prepare this image.'))
    reader.readAsDataURL(blob)
  })
}

function htmlCanvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This browser could not encode the image.')),
      type,
      quality,
    )
  })
}

/** Venice's single-image endpoints expect the base64 payload without a data-URL prefix. */
export function stripImageDataUrl(image: string): string {
  if (!image.startsWith('data:')) return image
  const comma = image.indexOf(',')
  return comma >= 0 ? image.slice(comma + 1) : image
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
    const type = 'image/jpeg'
    let output: Blob

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      output = await canvas.convertToBlob({ type, quality: OUTPUT_QUALITY })
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      output = await htmlCanvasToBlob(canvas, type, OUTPUT_QUALITY)
      canvas.width = 1
      canvas.height = 1
    }

    const dataUrl = await blobToDataUrl(output)
    return {
      dataUrl,
      name: file.name,
      originalBytes: file.size,
      preparedBytes: output.size || dataUrlBytes(dataUrl),
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
