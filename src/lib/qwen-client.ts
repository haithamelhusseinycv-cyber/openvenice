import type { ChatCompletionRequest } from '../types/venice'

export interface QwenClientConfig {
  baseUrl: string
  apiKey?: string
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

async function errorMessage(response: Response) {
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string }
    return data.error?.message || data.message || `${response.status} ${response.statusText}`
  } catch {
    try {
      const text = await response.text()
      return text || `${response.status} ${response.statusText}`
    } catch {
      return `${response.status} ${response.statusText}`
    }
  }
}

/**
 * Calls any OpenAI-compatible chat endpoint. The configured base URL should
 * normally end in /v1, e.g. https://qwen.example.com/v1.
 */
export async function qwenChatStream(
  config: QwenClientConfig,
  body: ChatCompletionRequest,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  if (!baseUrl) throw new Error('Qwen base URL is not configured.')

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(error instanceof Error ? `Qwen connection failed: ${error.message}` : 'Qwen connection failed.')
  }

  if (!response.ok) {
    throw new Error(`Qwen API error: ${await errorMessage(response)}`)
  }
  if (!response.body) throw new Error('Qwen API returned an empty streaming response.')
  return response.body
}
