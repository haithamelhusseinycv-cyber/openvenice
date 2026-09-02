import { parseSSEStream } from '../lib/stream'
import { qwenChatStream, type QwenClientConfig } from '../lib/qwen-client'
import { createOpenAIToolBindings, parseToolArguments, serializeToolResult, type OpenAIToolCall } from './openai-tools'
import { AgentToolRegistry } from './tool-registry'
import { AgentArtifactStore, type AgentArtifact } from './artifact-store'
import type { AgentToolResult } from './types'

interface QwenAgentRunOptions {
  config: QwenClientConfig
  model: string
  messages: unknown[]
  temperature: number
  topP: number
  maxTokens: number
  registry: AgentToolRegistry
  signal?: AbortSignal
  maxToolRounds?: number
  onModel?: (model: string) => void
  onContent?: (text: string) => void
  onReasoning?: (text: string) => void
  onToolStart?: (toolId: string) => void
  onToolFinish?: (toolId: string, ok: boolean) => void
  onArtifact?: (artifact: AgentArtifact) => void
}

interface PendingCall {
  id: string
  name: string
  arguments: string
}

function appendToolCall(map: Map<number, PendingCall>, raw: unknown) {
  if (!raw || typeof raw !== 'object') return
  const call = raw as {
    index?: number
    id?: string
    function?: { name?: string; arguments?: string }
  }
  const index = Number.isInteger(call.index) ? call.index as number : map.size
  const current = map.get(index) || { id: '', name: '', arguments: '' }
  if (call.id) current.id = call.id
  if (call.function?.name) current.name += call.function.name
  if (call.function?.arguments) current.arguments += call.function.arguments
  map.set(index, current)
}

function failedToolResult(message: string): AgentToolResult {
  return { ok: false, error: message }
}

function mimeTypeForFormat(format?: string) {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  if (format === 'raw') return 'application/octet-stream'
  return undefined
}

function imageMetadataFromUrl(url: string) {
  if (!url.startsWith('data:image/')) return { mimeType: undefined, format: undefined }
  const match = /^data:(image\/[^;,]+)/i.exec(url)
  const mimeType = match?.[1]?.toLowerCase()
  const format = mimeType?.split('/')[1]?.replace('jpg', 'jpeg')
  return { mimeType, format }
}

/**
 * Give tool calls compact handles for user image attachments while leaving the
 * original multimodal message untouched so Qwen-VL can still see the images.
 */
function seedAttachmentArtifacts(messages: unknown[], artifacts: AgentArtifactStore) {
  const handles: Array<{ index: number; ref: string }> = []
  let index = 0

  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const content = (message as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const value = part as { type?: string; image_url?: { url?: string } }
      const url = value.type === 'image_url' ? value.image_url?.url : undefined
      if (!url) continue
      index += 1
      const { mimeType, format } = imageMetadataFromUrl(url)
      const artifact = artifacts.put(url, {
        sourceTool: 'chat.attachment',
        mimeType,
        format,
        attachmentIndex: index,
      })
      handles.push({ index, ref: artifact.ref })
    }
  }

  return handles
}

/**
 * Tool payloads can contain multi-megabyte base64 images. Keep the bytes in a
 * private in-memory artifact store and give Qwen a compact artifact:// handle.
 * This lets a later tool in the same agent run consume the image without
 * pushing the full payload back through the model context.
 */
function externalizeImagePayload(
  result: AgentToolResult,
  artifacts: AgentArtifactStore,
  sourceTool: string,
  onArtifact?: (artifact: AgentArtifact) => void,
): AgentToolResult {
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return result
  const data = result.data as Record<string, unknown>
  const image = data.image
  if (typeof image !== 'string' || image.length <= 4096) return result

  const format = typeof data.format === 'string' ? data.format : undefined
  const mimeType = typeof data.mimeType === 'string' ? data.mimeType : mimeTypeForFormat(format)
  const artifact = artifacts.put(image, {
    sourceTool,
    format,
    mimeType,
    width: typeof data.width === 'number' ? data.width : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
  })
  onArtifact?.(artifact)

  return {
    ...result,
    data: {
      ...data,
      image: artifact.ref,
      artifact_ref: artifact.ref,
      base64_length: image.length,
    },
  }
}

/**
 * Runs Qwen with the registered tools and continues the conversation after
 * function calls. Tool calls are executed sequentially so stateful Android
 * operations (for example model selection before generation) remain ordered.
 */
export async function runQwenAgent(options: QwenAgentRunOptions) {
  const bindings = createOpenAIToolBindings(options.registry)
  const messages = [...options.messages]
  const maxRounds = Math.max(1, options.maxToolRounds ?? 4)
  const artifacts = new AgentArtifactStore()
  const attachments = seedAttachmentArtifacts(messages, artifacts)

  if (attachments.length > 0) {
    messages.push({
      role: 'system',
      content: `Tool image handles for the user attachments: ${attachments.map((item) => `attachment ${item.index} = ${item.ref}`).join(', ')}. Use these artifact:// handles in Local Dream and FaceFusion tool image fields instead of copying base64. The original images remain visible in the multimodal user message.`,
    })
  }

  for (let round = 0; round < maxRounds; round++) {
    const stream = await qwenChatStream(
      options.config,
      {
        model: options.model,
        messages,
        stream: true,
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens,
        tools: bindings.definitions,
        tool_choice: 'auto',
      },
      options.signal,
    )

    const pending = new Map<number, PendingCall>()
    let assistantContent = ''

    for await (const chunk of parseSSEStream(stream, { signal: options.signal })) {
      if (chunk.model) options.onModel?.(chunk.model)
      const delta = chunk.choices[0]?.delta as typeof chunk.choices[number]['delta'] & {
        reasoning?: string
        reasoning_text?: string
        tool_calls?: unknown[]
      }
      if (delta?.content) {
        assistantContent += delta.content
        options.onContent?.(delta.content)
      }
      const reasoning = delta?.reasoning_content || delta?.reasoning || delta?.reasoning_text
      if (reasoning) options.onReasoning?.(reasoning)
      if (Array.isArray(delta?.tool_calls)) {
        for (const call of delta.tool_calls) appendToolCall(pending, call)
      }
    }

    if (pending.size === 0) {
      return {
        completed: true,
        toolRounds: round,
        artifacts: artifacts.list().map(({ id, ref, metadata }) => ({ id, ref, metadata })),
      }
    }

    const toolCalls: OpenAIToolCall[] = Array.from(pending.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        id: call.id || `call_${round}_${index}`,
        type: 'function' as const,
        function: { name: call.name, arguments: call.arguments || '{}' },
      }))

    messages.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      const toolId = bindings.functionToToolId.get(call.function.name)
      let result: AgentToolResult
      if (!toolId) {
        result = failedToolResult(`Unknown tool function: ${call.function.name}`)
      } else {
        options.onToolStart?.(toolId)
        try {
          const input = parseToolArguments(call.function.arguments)
          const executed = await options.registry.execute(toolId, input, {
            signal: options.signal,
            artifacts,
          })
          result = externalizeImagePayload(executed, artifacts, toolId, options.onArtifact)
        } catch (error) {
          result = failedToolResult(error instanceof Error ? error.message : String(error))
        }
        options.onToolFinish?.(toolId, result.ok)
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: serializeToolResult(result),
      })
    }
  }

  throw new Error(`Agent stopped after ${maxRounds} tool-call rounds to prevent an execution loop.`)
}
