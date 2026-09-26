/** The OpenVenice host token is separate from the Venice provider API key. */
const STORAGE_KEY = 'openvenice-proxy-access'
export const HOST_ORIGIN = (import.meta.env.VITE_OPENVENICE_HOST || 'https://openvenice-production.up.railway.app').replace(/\/$/, '')

export function getProxyAccessToken(): string {
  try { return sessionStorage.getItem(STORAGE_KEY)?.trim() || '' } catch { return '' }
}

export function setProxyAccessToken(token: string): void {
  const value = token.trim()
  if (value && (!/^[A-Za-z0-9._~-]{24,}$/.test(value))) {
    throw new Error('The OpenVenice access token must have at least 24 URL-safe characters.')
  }
  if (value) sessionStorage.setItem(STORAGE_KEY, value)
  else sessionStorage.removeItem(STORAGE_KEY)
}
