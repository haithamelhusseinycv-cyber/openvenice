import type {
  FaceFusionBridgeTransport,
  FaceFusionDetectedFace,
  FaceFusionEnhanceRequest,
  FaceFusionJobResult,
  FaceFusionModelCatalog,
  FaceFusionSwapRequest,
} from './facefusion-connector'

interface CapacitorRuntime {
  getPlatform?: () => string
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise?: (pluginName: string, methodName: string, options: Record<string, unknown>) => Promise<unknown>
  Plugins?: Record<string, Record<string, (options?: Record<string, unknown>) => Promise<unknown>>>
}

declare global {
  interface Window {
    Capacitor?: CapacitorRuntime
  }
}

function capacitor() {
  return typeof window !== 'undefined' ? window.Capacitor : undefined
}

export function isNativeOpenVeniceAndroid() {
  const runtime = capacitor()
  if (!runtime) return false
  if (typeof runtime.isNativePlatform === 'function') return runtime.isNativePlatform()
  return runtime.getPlatform?.() === 'android'
}

async function invoke<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const runtime = capacitor()
  if (!runtime || !isNativeOpenVeniceAndroid()) {
    throw new Error('FaceFusion native bridge is only available inside the OpenVenice Android app.')
  }

  if (typeof runtime.nativePromise === 'function') {
    return await runtime.nativePromise('FaceFusionAgent', method, options) as T
  }

  const plugin = runtime.Plugins?.FaceFusionAgent
  const fn = plugin?.[method]
  if (!fn) throw new Error(`FaceFusionAgent native method is unavailable: ${method}`)
  return await fn(options) as T
}

async function invokeAbortable<T>(
  method: string,
  options: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let abortHandler: (() => void) | undefined
  if (signal) {
    abortHandler = () => { void invoke('cancel').catch(() => undefined) }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  try {
    const result = await invoke<T>(method, options)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return result
  } finally {
    if (signal && abortHandler) signal.removeEventListener('abort', abortHandler)
  }
}

export class CapacitorFaceFusionBridge implements FaceFusionBridgeTransport {
  async isAvailable(): Promise<boolean> {
    if (!isNativeOpenVeniceAndroid()) return false
    try {
      const runtime = capacitor()
      if (runtime?.isPluginAvailable && !runtime.isPluginAvailable('FaceFusionAgent')) return false
      const result = await invoke<{ available?: boolean }>('isAvailable')
      return result.available === true
    } catch {
      return false
    }
  }

  async listModels(): Promise<FaceFusionModelCatalog> {
    return await invoke<FaceFusionModelCatalog>('listModels')
  }

  async detectFaces(imageUri: string): Promise<FaceFusionDetectedFace[]> {
    const result = await invoke<{ faces?: FaceFusionDetectedFace[] }>('detectFaces', { imageUri })
    return Array.isArray(result.faces) ? result.faces : []
  }

  async swap(request: FaceFusionSwapRequest, signal?: AbortSignal): Promise<FaceFusionJobResult> {
    return await invokeAbortable<FaceFusionJobResult>('swap', { ...request }, signal)
  }

  async enhance(request: FaceFusionEnhanceRequest, signal?: AbortSignal): Promise<FaceFusionJobResult> {
    return await invokeAbortable<FaceFusionJobResult>('enhance', { ...request }, signal)
  }

  async cancel(): Promise<void> {
    if (!isNativeOpenVeniceAndroid()) return
    await invoke('cancel')
  }
}
