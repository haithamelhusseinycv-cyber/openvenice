/// <reference lib="webworker" />

const MAX_EDGE = 1280
const MAX_OUTPUT_BYTES = 900_000
const MIN_PIXELS = 65_536
const OUTPUT_TYPE = 'image/jpeg'

interface PrepareRequest {
  id: string
  file: File
  isHeic: boolean
}

type WorkerReply =
  | { id: string; kind: 'progress'; stage: 'decoding' | 'resizing' | 'compressing' | 'finalizing' }
  | { id: string; kind: 'success'; dataUrl: string; width: number; height: number; preparedBytes: number }
  | { id: string; kind: 'error'; message: string }

const worker = self as unknown as DedicatedWorkerGlobalScope

function progress(id: string, stage: Extract<WorkerReply, { kind: 'progress' }>['stage']) {
  worker.postMessage({ id, kind: 'progress', stage } satisfies WorkerReply)
}

async function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('This browser could not prepare the image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  return canvas.convertToBlob({ type: OUTPUT_TYPE, quality })
}

worker.onmessage = async (event: MessageEvent<PrepareRequest>) => {
  const { id, file, isHeic } = event.data
  let bitmap: ImageBitmap | null = null

  try {
    progress(id, 'decoding')
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      if (isHeic) throw new Error('This device could not decode the HEIC/HEIF image. Export it as JPEG or PNG, then upload again.')
      throw new Error('This image is corrupt or uses a format this browser cannot decode.')
    }

    if (bitmap.width * bitmap.height < MIN_PIXELS) {
      throw new Error('Image resolution is too small. Use an image with at least 65,536 total pixels.')
    }

    const initialRatio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    let width = Math.max(1, Math.round(bitmap.width * initialRatio))
    let height = Math.max(1, Math.round(bitmap.height * initialRatio))
    let quality = 0.84
    let output: Blob | null = null

    progress(id, 'resizing')
    for (let pass = 0; pass < 6; pass++) {
      progress(id, 'compressing')
      output = await encode(bitmap, width, height, quality)
      if (output.size <= MAX_OUTPUT_BYTES) break

      if (quality > 0.68) {
        quality = Math.max(0.68, quality - 0.08)
      } else {
        width = Math.max(640, Math.round(width * 0.82))
        height = Math.max(640, Math.round(height * 0.82))
        quality = 0.76
      }
    }

    if (!output) throw new Error('This browser could not compress the image.')
    progress(id, 'finalizing')
    const dataUrl = new FileReaderSync().readAsDataURL(output)
    worker.postMessage({
      id,
      kind: 'success',
      dataUrl,
      width,
      height,
      preparedBytes: output.size,
    } satisfies WorkerReply)
  } catch (error) {
    worker.postMessage({
      id,
      kind: 'error',
      message: error instanceof Error ? error.message : 'Could not prepare this image.',
    } satisfies WorkerReply)
  } finally {
    bitmap?.close()
  }
}

export {}
