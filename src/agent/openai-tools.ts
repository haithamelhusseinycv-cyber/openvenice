import type { AgentToolResult } from './types'
import { AgentToolRegistry } from './tool-registry'

export interface OpenAIToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAIToolBindings {
  definitions: OpenAIToolDefinition[]
  functionToToolId: Map<string, string>
}

function functionName(toolId: string) {
  return toolId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

export function createOpenAIToolBindings(registry: AgentToolRegistry): OpenAIToolBindings {
  const functionToToolId = new Map<string, string>()
  const definitions = registry.list().map((tool) => {
    const name = functionName(tool.id)
    functionToToolId.set(name, tool.id)
    return {
      type: 'function' as const,
      function: {
        name,
        description: `${tool.description} Risk: ${tool.risk}. Required permissions: ${tool.permissions.join(', ') || 'none'}.`,
        parameters: tool.inputSchema,
      },
    }
  })
  return { definitions, functionToToolId }
}

export function parseToolArguments(raw: string) {
  if (!raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return {}
  } catch {
    throw new Error('Tool arguments were not valid JSON.')
  }
}

function compactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 4096) return value
    return `[large payload omitted: ${value.length} characters]`
  }
  if (Array.isArray(value)) return value.map(compactValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, compactValue(item)]))
  }
  return value
}

export function serializeToolResult(result: AgentToolResult) {
  return JSON.stringify(compactValue(result))
}
