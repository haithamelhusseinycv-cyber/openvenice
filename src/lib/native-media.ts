import { isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'

interface MediaSaveResult {
  uri?: string
  fileName?: string
}

async function invokeMedia<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const runtime = typeof window !== 'undefined' ? window.Capacitor : undefined
  if (!runtime || !isNativeOpenVeniceAndroid()) throw new Error('Native media bridge is unavailable.')
  if (runtime.isPluginAvailable && !runtime.isPluginAvailable('MediaActions')) {
    throw new Error('Native media bridge is not installed.')
  }
  if (typeof runtime.nativePromise === 'function') {
    return await runtime.nativePromise('MediaActions', method, options) as T
  }
  const plugin = runtime.Plugins?.MediaActions
  const fn = plugin?.[method]
  if (!fn) throw new Error(`Native media method is unavailable: ${method}`)
  return await fn(options) as T
}

async function copyTextFallback(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Copy failed')
}

async function imageBlob(imageUrl: string, mimeType: string) {
  const response = await fetch(imageUrl)
  if (!response.ok && /^https?:/i.test(imageUrl)) throw new Error(`Could not read image (${response.status}).`)
  const blob = await response.blob()
  if (blob.type) return blob
  return new Blob([blob], { type: mimeType })
}

function extensionForMime(mimeType: string) {
  const lower = mimeType.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('webp')) return 'webp'
  if (lower.includes('gif')) return 'gif'
  return 'jpg'
}

export function defaultImageFileName(id: string, mimeType: string) {
  const safeId = id.replace(/[^a-z0-9_-]/gi, '-').slice(0, 48) || String(Date.now())
  return `openvenice-${safeId}.${extensionForMime(mimeType)}`
}

export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (isNativeOpenVeniceAndroid()) {
    try {
      await invokeMedia<void>('shareText', { text })
      return 'shared'
    } catch {
      // Fall through to Web Share/clipboard so the action still works in an
      // older OpenVenice Android build where the native plugin is absent.
    }
  }
  if (navigator.share) {
    await navigator.share({ text })
    return 'shared'
  }
  await copyTextFallback(text)
  return 'copied'
}

export async function saveImage(imageUrl: string, mimeType: string, fileName: string): Promise<MediaSaveResult> {
  if (isNativeOpenVeniceAndroid()) {
    try {
      return await invokeMedia<MediaSaveResult>('saveImage', {
        imageUri: imageUrl,
        mimeType,
        fileName,
      })
    } catch (error) {
      if (!imageUrl.startsWith('data:')) throw error
      // A browser fallback is useful during staged upgrades, especially if
      // the web bundle updates before the native shell does.
    }
  }

  const blob = await imageBlob(imageUrl, mimeType)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
  return { fileName }
}

export async function shareImage(imageUrl: string, mimeType: string, fileName: string): Promise<'shared' | 'saved'> {
  if (isNativeOpenVeniceAndroid()) {
    try {
      await invokeMedia<void>('shareImage', {
        imageUri: imageUrl,
        mimeType,
        fileName,
      })
      return 'shared'
    } catch (error) {
      if (!imageUrl.startsWith('data:')) throw error
    }
  }

  const blob = await imageBlob(imageUrl, mimeType)
  const file = new File([blob], fileName, { type: mimeType })
  const shareData: ShareData = { files: [file], title: 'OpenVenice image' }
  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData)
    return 'shared'
  }
  await saveImage(imageUrl, mimeType, fileName)
  return 'saved'
}

export async function copyImage(imageUrl: string, mimeType: string): Promise<'image' | 'url'> {
  if (isNativeOpenVeniceAndroid()) {
    try {
      await invokeMedia<void>('copyImage', { imageUri: imageUrl, mimeType })
      return 'image'
    } catch (error) {
      if (!imageUrl.startsWith('data:')) throw error
    }
  }

  const blob = await imageBlob(imageUrl, mimeType)
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || mimeType]: blob })])
    return 'image'
  }
  await copyTextFallback(imageUrl)
  return 'url'
}

export async function imageUrlToDataUrl(imageUrl: string, mimeType = 'image/jpeg'): Promise<string> {
  if (imageUrl.startsWith('data:image/')) return imageUrl
  const blob = await imageBlob(imageUrl, mimeType)
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Could not prepare image for editing.'))
    reader.readAsDataURL(blob)
  })
}
