import { venice } from './venice-client'
import { NODE_SCHEMAS, NODE_TYPES } from './workflow-schema'
import { DEFAULT_AGENT_MAX_TOKENS, DEFAULT_CHAT_MODEL_ID } from './allowed-models'
import type { WorkflowPatch } from './workflow-mutations'
import type { ChatCompletionResponse, ModelCapabilities } from '../types/venice'
import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData, VeniceNodeType } from '../stores/workflow-store'
import type { ModelCatalog } from '../hooks/use-model-catalog'

export interface AgentResponse {
  say: string
  patches: WorkflowPatch[]
  invalidPatches: number
}

const VALID_OPS = new Set(['add_node', 'remove_node', 'set_params', 'move_node', 'connect', 'disconnect', 'clear'])

export const DEFAULT_AGENT_MODEL = DEFAULT_CHAT_MODEL_ID

function nodeCatalog(): string {
  return NODE_TYPES
    .map((type) => NODE_SCHEMAS[type])
    .map((schema) => {
      const params = schema.params
        .map((param) => {
          const bits = [`${param.name}: ${param.type}${param.required ? ' (required)' : ''}`]
          if (param.default !== undefined && param.default !== '') bits.push(`default=${JSON.stringify(param.default)}`)
          if (param.enumValues) bits.push(`one of [${param.enumValues.filter(Boolean).join(', ')}]`)
          if (param.min !== undefined || param.max !== undefined) bits.push(`range ${param.min ?? '-'}..${param.max ?? '-'}`)
          return `    - ${bits.join(' — ')}`
        })
        .join('\n')
      return `- ${schema.type} (${schema.label}) | input=${schema.input} output=${schema.output}\n  ${schema.description}${params ? `\n  params:\n${params}` : ''}`
    })
    .join('\n\n')
}

function modelMenu(catalog: ModelCatalog | undefined): string {
  if (!catalog) return ''
  const sections: string[] = []
  if (catalog.text.length) sections.push(`chat: ${catalog.text.join(', ')}`)
  if (catalog.image.length) sections.push(`imageGen: ${catalog.image.join(', ')}`)
  if (sections.length === 0) return ''
  return `\n\nAllowlisted models per node type (use ONLY these ids):\n${sections.map((section) => `- ${section}`).join('\n')}`
}

const SYSTEM_PROMPT_BASE = `You are a workflow designer for a customized OpenVenice build. You help the user author visual workflows using only the enabled Chat and Image tools.\n\nEnabled node types:\n\n${nodeCatalog()}\n\nYou respond by emitting patches to mutate the current draft workflow. Each patch is one of:\n- {"op":"add_node","nodeType":"<type>","id":"optional_id","params":{...}}\n- {"op":"set_params","id":"<node_id>","params":{...}}\n- {"op":"connect","source":"<node_id>","target":"<node_id>"}\n- {"op":"disconnect","id":"<edge_id>"}\n- {"op":"remove_node","id":"<node_id>"}\n- {"op":"clear"}\n\nRULES:\n1. Every response MUST be one valid JSON object and nothing else.\n2. Schema: {"say": string, "patches": Array<Patch>}.\n3. "say" is a short narration or one concise question.\n4. For a new workflow, start with clear, then add enabled nodes and connect them.\n5. Assign explicit ids when adding multiple nodes.\n6. Use {{input}} to place upstream text. There is no {{node_id}} syntax.\n7. Use only the node types and parameters listed above. TTS, music, video, audio and embeddings are disabled.\n8. Model ids must come from the allowlisted model menu when it is present; never invent ids.\n9. Workflows should terminate at Output nodes.\n10. If the user asks only a question, return an empty patches array.\n11. Do not narrate patches you are not emitting.\n\nExample:\n{"say":"I built a pipeline that refines a concept into an image.","patches":[{"op":"clear"},{"op":"add_node","nodeType":"textInput","id":"in","params":{"inputText":"A rainy neon street at night"}},{"op":"add_node","nodeType":"chat","id":"prompt","params":{"prompt":"Turn this into a vivid photoreal image prompt.","temperature":0.7}},{"op":"add_node","nodeType":"imageGen","id":"art","params":{}},{"op":"add_node","nodeType":"output","id":"out"},{"op":"connect","source":"in","target":"prompt"},{"op":"connect","source":"prompt","target":"art"},{"op":"connect","source":"art","target":"out"}]}`

function buildSystemPrompt(catalog?: ModelCatalog): string {
  return SYSTEM_PROMPT_BASE + modelMenu(catalog)
}

function describeDraft(draft: { nodes: Node<VeniceNodeData>[]; edges: Edge[] }): string {
  if (draft.nodes.length === 0) return 'Current draft is empty.'
  const nodeLines = draft.nodes.map((node) => {
    const params: string[] = []
    const data = node.data as unknown as Record<string, unknown>
    for (const param of NODE_SCHEMAS[node.data.nodeType]?.params ?? []) {
      const value = data[param.name]
      if (value !== undefined && value !== '' && value !== null) {
        const display = typeof value === 'string' ? (value.length > 60 ? value.slice(0, 60) + '…' : value) : JSON.stringify(value)
        params.push(`${param.name}=${display}`)
      }
    }
    return `  - ${node.id} [${node.data.nodeType}] ${params.join(' ')}`
  })
  const edgeLines = draft.edges.map((edge) => `  - ${edge.id}: ${edge.source} → ${edge.target}`)
  return `Current draft:\nNodes:\n${nodeLines.join('\n')}\nEdges:\n${edgeLines.join('\n') || '  (none)'}`
}

function extractJson(raw: string): string {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) return trimmed.slice(first, last + 1)
  return trimmed
}

function isValidPatch(patch: unknown): patch is WorkflowPatch {
  if (!patch || typeof patch !== 'object') return false
  const obj = patch as Record<string, unknown>
  if (typeof obj.op !== 'string' || !VALID_OPS.has(obj.op)) return false
  switch (obj.op) {
    case 'clear':
      return true
    case 'add_node':
      return typeof obj.nodeType === 'string' && (NODE_TYPES as readonly string[]).includes(obj.nodeType)
    case 'remove_node':
    case 'disconnect':
      return typeof obj.id === 'string' && obj.id.length > 0
    case 'set_params':
      return typeof obj.id === 'string' && obj.id.length > 0 && typeof obj.params === 'object' && obj.params !== null
    case 'move_node':
      return typeof obj.id === 'string' && typeof obj.position === 'object' && obj.position !== null
    case 'connect':
      return typeof obj.source === 'string' && typeof obj.target === 'string' && obj.source !== obj.target
    default:
      return false
  }
}

function sanitizeParams(nodeType: VeniceNodeType, params: Record<string, unknown>): Partial<VeniceNodeData> {
  if (!(NODE_TYPES as readonly string[]).includes(nodeType)) return {}
  const schema = NODE_SCHEMAS[nodeType]
  const allowed = new Set(['model', 'prompt', ...schema.params.map((param) => param.name)])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (allowed.has(key)) out[key] = value
  }
  return out as Partial<VeniceNodeData>
}

export function parseAgentResponse(raw: string): AgentResponse {
  const json = extractJson(raw)
  let parsed: { say?: unknown; patches?: unknown }
  try {
    parsed = JSON.parse(json) as { say?: unknown; patches?: unknown }
  } catch {
    return { say: '', patches: [], invalidPatches: 0 }
  }

  const say = typeof parsed.say === 'string' ? parsed.say : ''
  const rawPatches = Array.isArray(parsed.patches) ? parsed.patches : []
  const patches: WorkflowPatch[] = []
  let invalidPatches = 0

  for (const rawPatch of rawPatches) {
    if (!isValidPatch(rawPatch)) {
      invalidPatches++
      continue
    }
    if (rawPatch.op === 'add_node' && rawPatch.params) {
      patches.push({ ...rawPatch, params: sanitizeParams(rawPatch.nodeType, rawPatch.params as Record<string, unknown>) })
    } else {
      patches.push(rawPatch)
    }
  }

  return { say, patches, invalidPatches }
}

interface CallAgentOptions {
  userMessage: string
  draft: { nodes: Node<VeniceNodeData>[]; edges: Edge[] }
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  catalog?: ModelCatalog
  model?: string
  capabilities?: ModelCapabilities
  signal?: AbortSignal
}

async function singleCall(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature: number
  useResponseFormat: boolean
  signal?: AbortSignal
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature,
    max_tokens: DEFAULT_AGENT_MAX_TOKENS,
  }
  if (opts.useResponseFormat) body.response_format = { type: 'json_object' }
  const response = await venice<ChatCompletionResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: opts.signal,
  })
  return response.choices[0]?.message?.content ?? ''
}

export async function callAgent({ userMessage, draft, history, catalog, model, capabilities, signal }: CallAgentOptions): Promise<AgentResponse> {
  const chosenModel = model || DEFAULT_AGENT_MODEL
  const useResponseFormat = capabilities?.supportsResponseSchema === true
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(catalog) },
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user' as const, content: `${describeDraft(draft)}\n\nUser: ${userMessage}\n\nReply with a single JSON object: {"say": "...", "patches": [...]}. No prose, no markdown fences.` },
  ]

  const raw = await singleCall({ model: chosenModel, messages, temperature: 0.3, useResponseFormat, signal })
  const parsed = parseAgentResponse(raw)

  if (parsed.patches.length === 0 && !parsed.say && raw.length > 0) {
    const retryMessages = [
      ...messages,
      { role: 'assistant' as const, content: raw },
      { role: 'user' as const, content: 'That was not valid JSON. Reply again with ONLY a single JSON object matching {"say": string, "patches": Patch[]}. No commentary, no fences.' },
    ]
    try {
      const retryRaw = await singleCall({ model: chosenModel, messages: retryMessages, temperature: 0, useResponseFormat, signal })
      return parseAgentResponse(retryRaw)
    } catch {
      // Fall through with the original response.
    }
  }

  return parsed
}
