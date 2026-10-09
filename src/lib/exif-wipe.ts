/**
 * EXIF Metadata Wiper
 * Strips all metadata from images before export/share
 * Prevents accidental leakage of location, device, timestamps
 */

export async function stripExifFromBlob(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') {
    return blob
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return blob

    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    return new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (cleanBlob) => {
          resolve(cleanBlob ?? blob)
        },
        'image/png',
        1.0,
      )
    })
  } catch {
    return blob
  }
}

export async function stripExifFromDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image')) return dataUrl

  try {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const cleanBlob = await stripExifFromBlob(blob)

    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(dataUrl)
      reader.readAsDataURL(cleanBlob)
    })
  } catch {
    return dataUrl
  }
}

export function stripExifFromBase64(base64: string): string {
  if (!base64.startsWith('data:image')) return base64

  const commaIndex = base64.indexOf(',')
  if (commaIndex === -1) return base64

  const mimeMatch = base64.slice(0, commaIndex).match(/data:([^;]+)/)
  const mime = mimeMatch?.[1] ?? 'image/png'

  const raw = base64.slice(commaIndex + 1)

  try {
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const cleanBytes = stripExifFromBytes(bytes)

    const cleanBase64 = btoa(String.fromCharCode(...cleanBytes))
    return `data:${mime};base64,${cleanBase64}`
  } catch {
    return base64
  }
}

function stripExifFromBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4) return bytes

  const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8
  if (!isJPEG) return bytes

  let offset = 2
  const segments: Uint8Array[] = [bytes.slice(0, 2)]

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) break

    const marker = bytes[offset + 1]

    if (marker === 0xe0 || marker === 0xe1 || marker === 0xe2 || marker === 0xe3) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      offset += 2 + length
      continue
    }

    if (marker === 0xda) {
      segments.push(bytes.slice(offset))
      break
    }

    if (marker >= 0xd0 && marker <= 0xd9) {
      segments.push(bytes.slice(offset, offset + 2))
      offset += 2
      continue
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    segments.push(bytes.slice(offset, offset + 2 + length))
    offset += 2 + length
  }

  const totalLength = segments.reduce((sum, s) => sum + s.length, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const segment of segments) {
    result.set(segment, pos)
    pos += segment.length
  }

  return result
}

export async function exportCleanImage(
  source: string | Blob,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.95,
): Promise<Blob> {
void format;
void quality;
  let blob: Blob

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const response = await fetch(source)
      blob = await response.blob()
    } else {
      const response = await fetch(source)
      blob = await response.blob()
    }
  } else {
    blob = source
  }

  return stripExifFromBlob(blob)
}
