/** The OpenVenice host token is separate from the Venice provider API key. */
const STORAGE_KEY = 'openvenice-proxy-access'
const VAULT_NAME = 'proxyAccess'
export const HOST_ORIGIN = (import.meta.env.VITE_OPENVENICE_HOST || 'https://openvenice-production.up.railway.app').replace(/\/$/, '')

interface CapacitorRuntime {
  getPlatform?: () => string
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise?: (pluginName: string, methodName: string, options: Record<string, unknown>) => Promise<unknown>
  Plugins?: Record<string, Record<string, (options?: Record<string, unknown>) => Promise<unknown>>>
}

function runtime(): CapacitorRuntime | undefined {
  return typeof window !== 'undefined' ? window.Capacitor : undefined
}

function isNativeAndroid() {
  const value = runtime()
  if (!value) return false
  if (value.isNativePlatform && !value.isNativePlatform()) return false
  return value.getPlatform?.() === 'android'
}

async function invokeVault<T>(method: string, options: Record<string, unknown>): Promise<T> {
  const value = runtime()
  if (!value || !isNativeAndroid()) throw new Error('Secure device storage is unavailable')
  if (value.isPluginAvailable && !value.isPluginAvailable('AuthVault')) throw new Error('AuthVault is unavailable')
  if (typeof value.nativePromise === 'function') return await value.nativePromise('AuthVault', method, options) as T
  const fn = value.Plugins?.AuthVault?.[method]
  if (!fn) throw new Error(`AuthVault method is unavailable: ${method}`)
  return await fn(options) as T
}

function validate(token: string) {
  if (token && !/^[A-Za-z0-9._~-]{24,}$/.test(token)) {
    throw new Error('The OpenVenice access token must have at least 24 URL-safe characters.')
  }
}

export function getProxyAccessToken(): string {
  try { return sessionStorage.getItem(STORAGE_KEY)?.trim() || '' } catch { return '' }
}

export function setProxyAccessToken(token: string): void {
  const value = token.trim()
  validate(value)
  if (value) sessionStorage.setItem(STORAGE_KEY, value)
  else sessionStorage.removeItem(STORAGE_KEY)
}

export async function saveProxyAccessToken(token: string, rememberOnDevice = false): Promise<void> {
  const value = token.trim()
  validate(value)
  setProxyAccessToken(value)
  if (!isNativeAndroid()) return
  if (value && rememberOnDevice) await invokeVault('saveNamed', { name: VAULT_NAME, value })
  else await invokeVault('clearNamed', { name: VAULT_NAME }).catch(() => undefined)
}

export async function hydrateProxyAccessTokenFromDevice(): Promise<boolean> {
  if (getProxyAccessToken()) return true
  if (!isNativeAndroid()) return false
  try {
    const result = await invokeVault<{ found?: boolean; value?: string }>('loadNamed', { name: VAULT_NAME })
    const value = result.found ? result.value?.trim() || '' : ''
    if (!value) return false
    validate(value)
    sessionStorage.setItem(STORAGE_KEY, value)
    return true
  } catch {
    return false
  }
}
