import { isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'

interface AuthVaultRuntime {
  isPluginAvailable?: (name: string) => boolean
  nativePromise?: (pluginName: string, methodName: string, options: Record<string, unknown>) => Promise<unknown>
  Plugins?: Record<string, Record<string, (options?: Record<string, unknown>) => Promise<unknown>>>
}

function vault(): AuthVaultRuntime | undefined {
  return typeof window !== 'undefined' ? window.Capacitor : undefined
}

async function invoke<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const runtime = vault()
  if (!runtime || !isNativeOpenVeniceAndroid()) throw new Error('Biometric gate is only available inside the OpenVenice Android app.')
  if (runtime.isPluginAvailable && !runtime.isPluginAvailable('AuthVault')) throw new Error('AuthVault native plugin is unavailable.')
  if (typeof runtime.nativePromise === 'function') {
    return await runtime.nativePromise('AuthVault', method, options) as T
  }
  const plugin = runtime.Plugins?.AuthVault
  const fn = plugin?.[method]
  if (!fn) throw new Error(`AuthVault method is unavailable: ${method}`)
  return await fn(options) as T
}

export interface BiometricAvailability {
  available: boolean
  biometric: boolean
}

/** Probe whether the native biometric front-door can be used on this device. */
export async function biometricGateAvailability(): Promise<BiometricAvailability> {
  if (!isNativeOpenVeniceAndroid()) return { available: false, biometric: false }
  try {
    const result = await invoke<BiometricAvailability>('isAvailable')
    return {
      available: result.available === true,
      biometric: result.biometric === true,
    }
  } catch {
    return { available: false, biometric: false }
  }
}

export interface GateResult {
  unlocked: boolean
  fallback?: boolean
}

/**
 * Show the platform biometric prompt. Resolves { unlocked: true } on success.
 * Devices without an enrolled authenticator fall open (never brick the app).
 */
export function requestBiometricGate(options: { title?: string; subtitle?: string } = {}): Promise<GateResult> {
  return invoke<GateResult>('gate', {
    title: options.title || 'Unlock OpenVenice',
    subtitle: options.subtitle || 'Noor stays private behind your screen lock.',
  })
}
