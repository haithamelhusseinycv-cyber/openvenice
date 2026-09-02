import { parseSSEStream } from '../lib/stream'
import { qwenChatStream, type QwenClientConfig } from '../lib/qwen-client'
import { createOpenAIToolBindings, parseToolArguments, serializeToolResult, type OpenAIToolCall } from './openai-tools'
import { AgentToolRegistry } from './tool-registry'

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

function failedToolResult(message: string) {
  return { ok: false, error: message }
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

    if (pending.size === 0) return { completed: true, toolRounds: round }

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
      let result
      if (!toolId) {
        result = failedToolResult(`Unknown tool function: ${call.function.name}`)
      } else {
        options.onToolStart?.(toolId)
        try {
          const input = parseToolArguments(call.function.arguments)
          result = await options.registry.execute(toolId, input, { signal: options.signal })
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
