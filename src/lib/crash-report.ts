import { isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'

interface MediaRuntime {
  isPluginAvailable?: (name: string) => boolean
  nativePromise?: (pluginName: string, methodName: string, options: Record<string, unknown>) => Promise<unknown>
  Plugins?: Record<string, Record<string, (options?: Record<string, unknown>) => Promise<unknown>>>
}

function mediaRuntime(): MediaRuntime | undefined {
  return typeof window !== 'undefined' ? window.Capacitor : undefined
}

async function invokeMedia<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const runtime = mediaRuntime()
  if (!runtime || !isNativeOpenVeniceAndroid()) throw new Error('Native media bridge is unavailable.')
  if (runtime.isPluginAvailable && !runtime.isPluginAvailable('MediaActions')) throw new Error('MediaActions plugin is unavailable.')
  if (typeof runtime.nativePromise === 'function') {
    return await runtime.nativePromise('MediaActions', method, options) as T
  }
  const plugin = runtime.Plugins?.MediaActions
  const fn = plugin?.[method]
  if (!fn) throw new Error(`MediaActions method is unavailable: ${method}`)
  return await fn(options) as T
}

export interface CrashReport {
  found: boolean
  path?: string
  content?: string
}

/** Read the last crash report the app wrote for itself, if any. */
export async function readLastCrashReport(): Promise<CrashReport | null> {
  if (!isNativeOpenVeniceAndroid()) return null
  try {
    return await invokeMedia<CrashReport>('getLastCrash')
  } catch {
    return null
  }
}

export async function clearLastCrashReport(): Promise<void> {
  if (!isNativeOpenVeniceAndroid()) return
  await invokeMedia('clearLastCrash').catch(() => undefined)
}

/** Copy the crash report to the system clipboard (native path, no CSP). */
export async function copyCrashReport(content: string): Promise<boolean> {
  try {
    await invokeMedia('copyText', { text: content })
    return true
  } catch {
    try {
      await navigator.clipboard?.writeText(content)
      return true
    } catch {
      return false
    }
  }
}
