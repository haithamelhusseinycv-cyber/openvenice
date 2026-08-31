const MAX_EDGE = 1280
export const MAX_INPUT_BYTES = 25 * 1024 * 1024
export const MAX_PREPARED_BYTES = 900_000
const OUTPUT_QUALITY = 0.82
const MAX_MAIN_THREAD_BYTES = 8 * 1024 * 1024
const WORKER_TIMEOUT_MS = 45_000

export type ImagePreparationStage = 'decoding' | 'resizing' | 'compressing' | 'finalizing'

interface PrepareImageOptions {
  signal?: AbortSignal
  onProgress?: (stage: ImagePreparationStage) => void
}

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

function abortError(): DOMException {
  return new DOMException('Image preparation cancelled.', 'AbortError')
}

function canPrepareInWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

export function isImageSizeAllowed(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_INPUT_BYTES
}

async function prepareImageInWorker(
  file: File,
  isHeic: boolean,
  options: PrepareImageOptions,
): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/image-prepare.worker.ts', import.meta.url), { type: 'module' })
    const id = crypto.randomUUID()
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      callback()
    }

    const onAbort = () => finish(() => reject(abortError()))
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('Image preparation took too long. Try a smaller image or close other phone apps.')))
    }, WORKER_TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<{
      id: string
      kind: 'progress' | 'success' | 'error'
      stage?: ImagePreparationStage
      dataUrl?: string
      width?: number
      height?: number
      preparedBytes?: number
      message?: string
    }>) => {
      if (event.data.id !== id || settled) return
      if (event.data.kind === 'progress' && event.data.stage) {
        options.onProgress?.(event.data.stage)
        return
      }
      if (event.data.kind === 'error') {
        finish(() => reject(new Error(event.data.message || 'Could not prepare this image.')))
        return
      }
      if (event.data.kind === 'success' && event.data.dataUrl) {
        finish(() => resolve({
          dataUrl: event.data.dataUrl!,
          name: file.name,
          originalBytes: file.size,
          preparedBytes: event.data.preparedBytes || dataUrlBytes(event.data.dataUrl!),
          width: event.data.width || 0,
          height: event.data.height || 0,
          format: 'JPEG',
        }))
      }
    }

    worker.onerror = () => finish(() => reject(new Error('Background image processing failed. Update Chrome and try again.')))
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) {
      onAbort()
      return
    }
    worker.postMessage({ id, file, isHeic })
  })
}

/** Venice's single-image endpoints expect the base64 payload without a data-URL prefix. */
export function stripImageDataUrl(image: string): string {
  if (!image.startsWith('data:')) return image
  const comma = image.indexOf(',')
  return comma >= 0 ? image.slice(comma + 1) : image
}

export async function prepareImage(file: File, options: PrepareImageOptions = {}): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Select a supported image file.')
  if (file.size === 0) throw new Error('This image file is empty.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is larger than 25 MB. Choose a smaller file.')

  const isHeic = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type)
  if (canPrepareInWorker()) return prepareImageInWorker(file, isHeic, options)
  if (file.size > MAX_MAIN_THREAD_BYTES) {
    throw new Error('This browser cannot safely process a large photo in the background. Update Chrome, then try again.')
  }

  if (options.signal?.aborted) throw abortError()
  options.onProgress?.('decoding')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    if (isHeic) throw new Error('This device could not decode the HEIC/HEIF image. Export it as JPEG or PNG, then upload again.')
    throw new Error('This image is corrupt or uses a format this browser cannot decode.')
  }
  try {
    if (options.signal?.aborted) throw abortError()
    const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    if (width * height < 65_536) throw new Error('Image resolution is too small. Use an image with at least 65,536 total pixels.')
    const type = 'image/jpeg'
    let output: Blob
    options.onProgress?.('resizing')

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      options.onProgress?.('compressing')
      output = await canvas.convertToBlob({ type, quality: OUTPUT_QUALITY })
      if (output.size > MAX_PREPARED_BYTES) output = await canvas.convertToBlob({ type, quality: 0.7 })
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      options.onProgress?.('compressing')
      output = await htmlCanvasToBlob(canvas, type, OUTPUT_QUALITY)
      if (output.size > MAX_PREPARED_BYTES) output = await htmlCanvasToBlob(canvas, type, 0.7)
      canvas.width = 1
      canvas.height = 1
    }

    if (options.signal?.aborted) throw abortError()
    options.onProgress?.('finalizing')
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
