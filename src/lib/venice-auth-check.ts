import { VENICE_BASE_URL } from './venice-client'

export class VeniceAuthCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VeniceAuthCheckError'
  }
}

/**
 * Venice's API-key guide recommends GET /models as the low-risk authenticated
 * request for verifying a bearer key. This helper deliberately avoids the normal
 * client because the candidate key has not been stored yet.
 */
export async function validateVeniceApiKey(key: string, signal?: AbortSignal): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${VENICE_BASE_URL}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key.trim()}` },
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new VeniceAuthCheckError('Could not reach Venice to verify the API key. Check your connection and try again.')
  }

  if (response.ok) return

  if (response.status === 401 || response.status === 403) {
    throw new VeniceAuthCheckError('Venice rejected this API key. Check that the full key was copied correctly and is still active.')
  }

  let detail = ''
  try {
    const raw = await response.text()
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: string | { message?: string }; message?: string }
        detail = typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error?.message || parsed.message || ''
      } catch {
        detail = raw.slice(0, 180)
      }
    }
  } catch {
    // Keep the generic status message.
  }

  throw new VeniceAuthCheckError(
    detail
      ? `Venice could not verify the key (${response.status}): ${detail}`
      : `Venice could not verify the key (HTTP ${response.status}). Try again shortly.`,
  )
}
