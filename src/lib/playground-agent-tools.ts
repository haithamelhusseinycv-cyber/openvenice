/**
 * Tool-calling architecture for the Playground meta-agent.
 * The customized build deliberately exposes only text and still-image workflow nodes.
 */

import { venice } from './venice-client'
import { generateId } from './utils'
import { NODE_SCHEMAS, NODE_TYPES } from './workflow-schema'
import {
  DEFAULT_AGENT_MAX_TOKENS,
  resolveChatModel,
} from './allowed-models'
import type { WorkflowPatch } from './workflow-mutations'
import type { ModelCapabilities } from '../types/venice'
import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData, VeniceNodeType } from '../stores/workflow-store'
import type { ModelCatalog } from '../hooks/use-model-catalog'
import type { AgentModel } from '../hooks/use-agent-models'

interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'clear',
      description: 'Remove all nodes and edges. Use when starting a fresh workflow.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_node',
      description:
        'Add an enabled node to the canvas. Returns the assigned id. ' +
        'Use {{input}} inside prompt fields to inject upstream text.',
      parameters: {
        type: 'object',
        properties: {
          node_type: {
            type: 'string',
            enum: NODE_TYPES,
            description: 'Enabled node type.',
          },
          id: {
            type: 'string',
            description: 'Optional explicit id. Use it in later connect/set_params calls.',
          },
          params: {
            type: 'object',
            description: 'Node-specific params. Omit fields to use schema defaults.',
            additionalProperties: true,
          },
        },
        required: ['node_type'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'connect',
      description: 'Connect two nodes so data flows from source to target.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
        },
        required: ['source', 'target'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_params',
      description: 'Update validated params on an existing node.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          params: { type: 'object', additionalProperties: true },
        },
        required: ['id', 'params'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_node',
      description: 'Remove a node and its connected edges.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pick_model',
      description: 'Pick an allowlisted model for Chat or Image Gen.',
      parameters: {
        type: 'object',
        properties: {
          node_type: {
            type: 'string',
            enum: ['chat', 'imageGen'],
          },
          prefer: {
            type: 'string',
            enum: ['fast', 'best', 'web', 'reasoning', 'uncensored'],
            description: 'Optional preference used only within the configured allowlist.',
          },
        },
        required: ['node_type'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Pause to ask one specific clarifying question.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string' } },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description: 'Signal that the workflow is complete.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  },
]

function nodeCatalog(): string {
  return NODE_TYPES
    .map((type) => NODE_SCHEMAS[type])
    .map((schema) => {
      const params = schema.params
        .map((p) => {
          const bits = [`${p.name}: ${p.type}${p.required ? ' (required)' : ''}`]
          if (p.default !== undefined && p.default !== '') bits.push(`default=${JSON.stringify(p.default)}`)
          if (p.enumValues) bits.push(`one of [${p.enumValues.filter(Boolean).join(', ')}]`)
          if (p.min !== undefined || p.max !== undefined) bits.push(`range ${p.min ?? '-'}..${p.max ?? '-'}`)
          return `    - ${bits.join(' — ')}`
        })
        .join('\n')
      return `- ${schema.type} (${schema.label}) | input=${schema.input} output=${schema.output}\n  ${schema.description}${params ? `\n  params:\n${params}` : ''}`
    })
    .join('\n\n')
}

const SYSTEM_PROMPT = `You are a workflow designer for a customized OpenVenice build. Build visual workflows by calling tools.

Enabled node types:\n\n${nodeCatalog()}

Rules:
1. Use tools whenever the request requires workflow changes.
2. For a fresh workflow, call clear(), add enabled nodes, connect them, then call done().
3. Assign explicit ids to new nodes so later calls can reference them.
4. Use {{input}} in prompt/inputText fields for upstream content. There is no {{node_id}} syntax.
5. Use realistic content rather than placeholder text when the user supplied a concrete task.
6. Model ids must come from pick_model or the live allowlisted catalog. Never invent a model id.
7. This build supports Chat and Image Gen only. Do not create TTS, music, video, audio, embedding, or other disabled nodes.
8. Prefer the configured default/fast Chat model unless the task clearly benefits from web search, reasoning, or another allowlisted capability.
9. For image workflows, a reliable shape is Input → Chat (prompt/refinement) → Image Gen → Output.
10. Ask one concise question only when a required choice is genuinely ambiguous.
11. Every useful branch should terminate at an Output node.
12. End successful builds with done(summary).`

const MAX_ITERATIONS = 16

export interface RunStep {
  tool: string
  args: Record<string, unknown>
  result: ToolResult
}

export interface RunResult {
  say: string
  tool_calls: number
  asked_user: boolean
}

interface ToolResult {
  ok?: boolean
  id?: string
  edge_id?: string
  model?: string
  error?: string
  message?: string
}

export interface RunOptions {
  userMessage: string
  draft: { nodes: Node<VeniceNodeData>[]; edges: Edge[] }
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  catalog?: ModelCatalog
  agentModels?: AgentModel[]
  model: string
  capabilities?: ModelCapabilities
  signal?: AbortSignal
  applyPatch: (patch: WorkflowPatch) => { ok: true; id?: string; edge_id?: string } | { error: string }
  onStep?: (step: RunStep) => void
}

interface AssistantMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

interface ToolMessage {
  role: 'tool'
  tool_call_id: string
  content: string
}

interface SystemMessage { role: 'system'; content: string }
interface UserMessage { role: 'user'; content: string }
type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage

interface ToolCallResponse {
  choices: Array<{
    message: AssistantMessage
    finish_reason: string
  }>
}

function describeDraft(draft: { nodes: Node<VeniceNodeData>[]; edges: Edge[] }): string {
  if (draft.nodes.length === 0) return 'Current draft is empty.'
  const nodes = draft.nodes.map((n) => `  - ${n.id} [${n.data.nodeType}]`).join('\n')
  const edges = draft.edges.map((e) => `  - ${e.source} → ${e.target}`).join('\n') || '  (none)'
  return `Current draft:\nNodes:\n${nodes}\nEdges:\n${edges}`
}

function isEnabledNodeType(value: unknown): value is VeniceNodeType {
  return typeof value === 'string' && (NODE_TYPES as readonly string[]).includes(value)
}

function isModelValid(nodeType: VeniceNodeType, modelId: string, opts: RunOptions): boolean {
  const catalog = opts.catalog
  if (!catalog) return true
  if (nodeType === 'chat') return catalog.text.includes(modelId)
  if (nodeType === 'imageGen') return catalog.image.includes(modelId)
  return nodeType === 'textInput' || nodeType === 'output'
}

function pickModel(nodeType: string, prefer: string | undefined, opts: RunOptions): string | undefined {
  const catalog = opts.catalog
  if (!catalog) return undefined

  if (nodeType === 'chat') {
    const agents = opts.agentModels ?? []
    if (agents.length === 0) return catalog.text[0]

    const scored = agents
      .filter((m) => catalog.text.includes(m.id))
      .map((m) => {
        let score = 0
        const caps = m.capabilities
        if (prefer === 'web') score += caps.supportsWebSearch ? 100 : -100
        if (prefer === 'reasoning') score += caps.supportsReasoning ? 100 : -100
        if (prefer === 'uncensored') score += m.uncensored ? 100 : -100
        if (prefer === 'best') {
          if (m.traits.includes('most_intelligent')) score += 80
          if (m.contextTokens && m.contextTokens >= 200_000) score += 20
        }
        if (prefer === 'fast' || !prefer) {
          if (caps.supportsReasoning) score -= 30
          if (m.traits.includes('function_calling_default')) score += 50
          if (m.recommended) score += 30
        }
        if (caps.supportsResponseSchema) score += 10
        score -= m.tier * 5
        return { id: m.id, score }
      })
      .sort((a, b) => b.score - a.score)

    return scored[0]?.id ?? catalog.text[0]
  }

  if (nodeType === 'imageGen') return catalog.image[0]
  return undefined
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function validateParams(
  nodeType: VeniceNodeType,
  rawParams: Record<string, unknown>,
  opts: RunOptions,
): { params?: Partial<VeniceNodeData>; error?: string } {
  if (!isEnabledNodeType(nodeType)) return { error: `${String(nodeType)} is disabled in this build.` }
  const schema = NODE_SCHEMAS[nodeType]
  const allowed = new Set(['model', 'prompt', ...schema.params.map((p) => p.name)])
  const params: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rawParams)) {
    if (allowed.has(key)) params[key] = value
  }

  if (typeof params.model === 'string' && params.model && !isModelValid(nodeType, params.model, opts)) {
    return { error: `Model '${params.model}' is not allowlisted for ${nodeType}. Use pick_model first.` }
  }

  for (const param of schema.params) {
    const value = params[param.name]
    if (value === undefined) continue

    if (param.enumValues) {
      if (typeof value === 'boolean') {
        params[param.name] = value
          ? (param.enumValues.includes('on') ? 'on' : param.enumValues[0])
          : (param.enumValues.includes('off') ? 'off' : '')
        continue
      }
      if (typeof value !== 'string' || !param.enumValues.includes(value)) {
        return { error: `Invalid value for ${nodeType}.${param.name}: ${JSON.stringify(value)}.` }
      }
      continue
    }

    if (param.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { error: `${nodeType}.${param.name} must be a finite number.` }
      }
      if (param.min !== undefined && value < param.min) {
        return { error: `${nodeType}.${param.name} must be at least ${param.min}.` }
      }
      if (param.max !== undefined && value > param.max) {
        return { error: `${nodeType}.${param.name} must be at most ${param.max}.` }
      }
    } else if (param.type === 'boolean' && typeof value !== 'boolean') {
      return { error: `${nodeType}.${param.name} must be boolean.` }
    } else if ((param.type === 'string' || param.type === 'text') && typeof value !== 'string') {
      return { error: `${nodeType}.${param.name} must be text.` }
    }
  }

  return { params: params as Partial<VeniceNodeData> }
}

function handleTool(
  name: string,
  args: Record<string, unknown>,
  opts: RunOptions,
  nodeTypesById: Map<string, VeniceNodeType>,
): ToolResult {
  try {
    switch (name) {
      case 'clear': {
        const result = opts.applyPatch({ op: 'clear' })
        if ('error' in result) return { error: result.error }
        nodeTypesById.clear()
        return { ok: true }
      }
      case 'add_node': {
        if (!isEnabledNodeType(args.node_type)) return { error: `Unknown or disabled node_type: ${String(args.node_type)}` }
        const nodeType = args.node_type
        const id = (typeof args.id === 'string' && args.id.trim()) || generateId()
        const rawParams = (typeof args.params === 'object' && args.params !== null ? args.params : {}) as Record<string, unknown>
        const validated = validateParams(nodeType, rawParams, opts)
        if (validated.error) return { error: validated.error }

        const result = opts.applyPatch({ op: 'add_node', nodeType, id, params: validated.params })
        if ('error' in result) return { error: result.error }
        nodeTypesById.set(result.id ?? id, nodeType)
        return { ok: true, id: result.id ?? id }
      }
      case 'connect': {
        const source = String(args.source ?? '')
        const target = String(args.target ?? '')
        if (!source || !target) return { error: 'Both source and target are required.' }
        if (!nodeTypesById.has(source) || !nodeTypesById.has(target)) return { error: 'Source or target node does not exist.' }
        const result = opts.applyPatch({ op: 'connect', source, target })
        if ('error' in result) return { error: result.error }
        return { ok: true, edge_id: result.edge_id }
      }
      case 'set_params': {
        const id = String(args.id ?? '')
        const nodeType = nodeTypesById.get(id)
        if (!nodeType) return { error: `Node '${id}' does not exist.` }
        const rawParams = (typeof args.params === 'object' && args.params !== null ? args.params : {}) as Record<string, unknown>
        const validated = validateParams(nodeType, rawParams, opts)
        if (validated.error) return { error: validated.error }
        const result = opts.applyPatch({ op: 'set_params', id, params: validated.params ?? {} })
        if ('error' in result) return { error: result.error }
        return { ok: true }
      }
      case 'remove_node': {
        const id = String(args.id ?? '')
        if (!id) return { error: 'Node id is required.' }
        const result = opts.applyPatch({ op: 'remove_node', id })
        if ('error' in result) return { error: result.error }
        nodeTypesById.delete(id)
        return { ok: true }
      }
      case 'pick_model': {
        const nodeType = String(args.node_type ?? '')
        if (nodeType !== 'chat' && nodeType !== 'imageGen') return { error: `No model is enabled for ${nodeType}.` }
        const prefer = typeof args.prefer === 'string' ? args.prefer : undefined
        const id = pickModel(nodeType, prefer, opts)
        if (!id) return { error: `No allowlisted model is currently available for ${nodeType}.` }
        return { ok: true, model: id }
      }
      case 'ask_user':
        return { ok: true, message: String(args.question ?? '') }
      case 'done':
        return { ok: true, message: String(args.summary ?? 'Done.') }
      default:
        return { error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Tool failed' }
  }
}

export async function runAgentTools(opts: RunOptions): Promise<RunResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...opts.history.map<UserMessage | AssistantMessage>((m) => (
      m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content }
    )),
    { role: 'user', content: `${describeDraft(opts.draft)}\n\nUser request: ${opts.userMessage}` },
  ]
  const nodeTypesById = new Map(opts.draft.nodes.map((node) => [node.id, node.data.nodeType]))
  let toolCallCount = 0

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const resp = await venice<ToolCallResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: resolveChatModel(opts.model),
        messages,
        temperature: 0.2,
        max_tokens: DEFAULT_AGENT_MAX_TOKENS,
        tools: TOOLS,
        tool_choice: 'auto',
      }),
      signal: opts.signal,
    })

    const message = resp.choices[0]?.message
    if (!message) return { say: 'Empty response from agent.', tool_calls: toolCallCount, asked_user: false }

    messages.push({
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    })

    const calls = message.tool_calls ?? []
    if (calls.length === 0) {
      return {
        say: (message.content || '').trim() || `Made ${toolCallCount} edit${toolCallCount === 1 ? '' : 's'}.`,
        tool_calls: toolCallCount,
        asked_user: false,
      }
    }

    let terminalSay: string | null = null
    let terminalAsked = false

    for (const call of calls) {
      const name = call.function?.name ?? ''
      const args = safeParseArgs(call.function?.arguments)
      const result = handleTool(name, args, opts, nodeTypesById)
      toolCallCount++
      opts.onStep?.({ tool: name, args, result })

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })

      if (name === 'done') {
        terminalSay = result.message ?? 'Done.'
      } else if (name === 'ask_user') {
        terminalSay = result.message ?? 'Need clarification.'
        terminalAsked = true
      }
    }

    if (terminalSay !== null) {
      return { say: terminalSay, tool_calls: toolCallCount, asked_user: terminalAsked }
    }
  }

  return {
    say: `Stopped after ${MAX_ITERATIONS} iterations and ${toolCallCount} edits — let me know if it needs adjusting.`,
    tool_calls: toolCallCount,
    asked_user: false,
  }
}
