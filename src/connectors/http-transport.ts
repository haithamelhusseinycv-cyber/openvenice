import { getProxyAccessToken, HOST_ORIGIN } from '../lib/proxy-access'
import { isNativeOpenVeniceAndroid } from './facefusion/capacitor-facefusion-bridge'

async function nativeConnectorRequest(url: string, options: HttpRequestOptions): Promise<Response> {
  if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
  const runtime = window.Capacitor
  if (!runtime) throw new Error('OpenVenice native bridge is unavailable')
  const method = options.method || 'GET'
  if (method !== 'GET' && method !== 'POST') throw new Error('The native connector supports GET and POST')
  const headers = authenticatedHeaders(url, options.headers)
  const request = {
    url: `${HOST_ORIGIN}${url}`,
    method,
    headers: Object.fromEntries(headers.entries()),
    ...(typeof options.body === 'string' ? { body: options.body } : {}),
  }
  const result = (typeof runtime.nativePromise === 'function'
    ? await runtime.nativePromise('VoiceChat', 'fetchBinary', request)
    : await runtime.Plugins?.VoiceChat?.fetchBinary(request)) as {
    status: number; contentType: string; bodyBase64: string
  } | undefined
  if (!result) throw new Error('OpenVenice native connector is unavailable')
  const raw = atob(result.bodyBase64 || '')
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0))
  return new Response(bytes, { status: result.status, headers: { 'Content-Type': result.contentType } })
}

function connectorFetch(url: string, options: HttpRequestOptions): Promise<Response> {
  if (url.startsWith('/connectors/') && isNativeOpenVeniceAndroid()) return nativeConnectorRequest(url, options)
  return fetch(url, {
    method: options.method || 'GET',
    headers: authenticatedHeaders(url, options.headers),
    body: toBody(options.body),
    signal: options.signal,
  })
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string | Uint8Array
  signal?: AbortSignal
}

export interface SseMessage {
  event?: string
  data: string
}

export interface BinaryHttpResponse {
  status: number
  data: Uint8Array
  headers: Record<string, string>
  contentType?: string
}

export interface ConnectorHttpTransport {
  requestJson<T>(url: string, options?: HttpRequestOptions): Promise<T>
  requestBinary(url: string, options?: HttpRequestOptions): Promise<BinaryHttpResponse>
  requestSse(url: string, options?: HttpRequestOptions): AsyncGenerator<SseMessage, void, void>
}

function toBody(body: string | Uint8Array | undefined): BodyInit | undefined {
  if (typeof body === 'string' || body === undefined) return body
  return new Blob([body as BlobPart])
}

function authenticatedHeaders(url: string, headers: Record<string, string> | undefined) {
  const next = new Headers(headers)
  if (url.startsWith('/connectors/')) {
    const accessToken = getProxyAccessToken()
    if (accessToken) next.set('X-OpenVenice-Access', accessToken)
  }
  return next
}

async function throwHttpError(response: Response): Promise<never> {
  // Do not relay provider diagnostics or account metadata into the model/UI.
  await response.body?.cancel().catch(() => undefined)
  throw new Error(`Connector request failed: HTTP ${response.status}`)
}

export class FetchHttpTransport implements ConnectorHttpTransport {
  async requestJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const response = await connectorFetch(url, options)

    if (!response.ok) await throwHttpError(response)
    return (await response.json()) as T
  }

  async requestBinary(url: string, options: HttpRequestOptions = {}): Promise<BinaryHttpResponse> {
    const response = await connectorFetch(url, options)

    if (!response.ok) await throwHttpError(response)

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    return {
      status: response.status,
      data: new Uint8Array(await response.arrayBuffer()),
      headers,
      contentType: response.headers.get('content-type') || undefined,
    }
  }

  async *requestSse(url: string, options: HttpRequestOptions = {}): AsyncGenerator<SseMessage, void, void> {
    const response = await connectorFetch(url, options)

    if (!response.ok) await throwHttpError(response)
    if (!response.body) throw new Error('Streaming response body unavailable')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary).replace(/\r/g, '')
        buffer = buffer.slice(boundary + 2)
        const lines = block.split('\n')
        let event: string | undefined
        const data: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
        }
        if (data.length) yield { event, data: data.join('\n') }
        boundary = buffer.indexOf('\n\n')
      }
    }
  }
}
