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

async function throwHttpError(response: Response): Promise<never> {
  const text = await response.text().catch(() => '')
  throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ''}`)
}

export class FetchHttpTransport implements ConnectorHttpTransport {
  async requestJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: toBody(options.body),
      signal: options.signal,
    })

    if (!response.ok) await throwHttpError(response)
    return (await response.json()) as T
  }

  async requestBinary(url: string, options: HttpRequestOptions = {}): Promise<BinaryHttpResponse> {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: toBody(options.body),
      signal: options.signal,
    })

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
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: toBody(options.body),
      signal: options.signal,
    })

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
