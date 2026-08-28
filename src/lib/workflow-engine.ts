import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData, NodeResult } from '../stores/workflow-store'
import { NODE_SCHEMAS, type IOKind } from './workflow-schema'
import { validateWorkflow } from './workflow-validator'
import { venice } from './venice-client'
import type { ChatCompletionResponse, ImageGenerateResponse } from '../types/venice'
import {
  DEFAULT_CHAT_MAX_TOKENS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  resolveChatModel,
  resolveImageModel,
} from './allowed-models'

export class WorkflowExecutionError extends Error {
  nodeId?: string
  constructor(message: string, nodeId?: string) {
    super(message)
    this.name = 'WorkflowExecutionError'
    this.nodeId = nodeId
  }
}

function topoLevels(nodes: Node<VeniceNodeData>[], edges: Edge[]): string[][] | null {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }
  const levels: string[][] = []
  let frontier = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  let visited = 0
  while (frontier.length > 0) {
    levels.push(frontier)
    visited += frontier.length
    const next: string[] = []
    for (const id of frontier) {
      for (const child of adj.get(id) ?? []) {
        const d = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, d)
        if (d === 0) next.push(child)
      }
    }
    frontier = next
  }
  return visited === nodes.length ? levels : null
}

function getInputs(nodeId: string, edges: Edge[], outputs: Map<string, string>): string {
  const parentEdges = edges.filter((e) => e.target === nodeId)
  const inputs = parentEdges.map((e) => outputs.get(e.source) ?? '').filter(Boolean)
  return inputs.join('\n\n')
}

function resolvePrompt(template: string, input: string): string {
  if (!template) return input
  if (template.includes('{{input}}')) return template.replace(/\{\{input\}\}/g, input)
  return input ? `${template}\n\n${input}` : template
}

async function executeNode(
  node: Node<VeniceNodeData>,
  input: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = node.data
  switch (data.nodeType) {
    case 'textInput':
      return data.inputText ?? ''

    case 'output':
      return input

    case 'chat': {
      const prompt = resolvePrompt(data.prompt, input)
      const resp = await venice<ChatCompletionResponse>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: resolveChatModel(data.model || DEFAULT_CHAT_MODEL_ID),
          messages: [{ role: 'user', content: prompt }],
          temperature: data.temperature ?? 0.7,
          max_tokens: data.maxTokens ?? DEFAULT_CHAT_MAX_TOKENS,
          venice_parameters: { enable_web_search: data.webSearch ?? 'off' },
        }),
        signal,
      })
      return resp.choices[0]?.message?.content ?? ''
    }

    case 'imageGen': {
      const prompt = resolvePrompt(data.prompt, input)
      const body: Record<string, unknown> = {
        model: resolveImageModel(data.model || DEFAULT_IMAGE_MODEL_ID),
        prompt,
        negative_prompt: data.negativePrompt || undefined,
        steps: data.steps ?? 20,
        width: data.width ?? 1024,
        height: data.height ?? 1024,
        hide_watermark: data.hideWatermark ?? true,
        safe_mode: false,
        enhance_prompt: false,
      }
      if (data.aspectRatio) body.aspect_ratio = data.aspectRatio
      const resp = await venice<ImageGenerateResponse>('/image/generate', {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      })
      const img = resp.images[0]
      const b64 = typeof img === 'string' ? img : img.b64_json
      const mime = b64.startsWith('/9j/') ? 'image/jpeg'
        : b64.startsWith('iVBOR') ? 'image/png'
        : b64.startsWith('UklGR') ? 'image/webp'
        : 'image/png'
      return `[image:data:${mime};base64,${b64}]`
    }

    case 'tts':
    case 'music':
    case 'video':
      throw new WorkflowExecutionError(
        `${data.nodeType} nodes are disabled in this build. Use Chat and Image Gen only.`,
        node.id,
      )
  }
}

export interface ExecuteOptions {
  signal?: AbortSignal
  onUpdate: (nodeId: string, result: Partial<NodeResult>) => void
}

export async function executeWorkflow(
  nodes: Node<VeniceNodeData>[],
  edges: Edge[],
  arg: ExecuteOptions | ((nodeId: string, result: Partial<NodeResult>) => void),
): Promise<void> {
  const opts: ExecuteOptions = typeof arg === 'function' ? { onUpdate: arg } : arg
  const { signal, onUpdate } = opts

  const validation = validateWorkflow({ nodes, edges })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new WorkflowExecutionError(first?.message ?? 'Workflow has validation errors.', first?.nodeId)
  }

  const levels = topoLevels(nodes, edges)
  if (!levels) throw new WorkflowExecutionError('Workflow contains a cycle.')

  const outputs = new Map<string, string>()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  for (const level of levels) {
    if (signal?.aborted) return
    await Promise.all(level.map(async (nodeId) => {
      const node = nodeMap.get(nodeId)
      if (!node) return
      onUpdate(nodeId, { status: 'running', output: undefined, error: undefined })
      try {
        const input = getInputs(nodeId, edges, outputs)
        const output = await executeNode(node, input, signal)
        outputs.set(nodeId, output)
        const kind = NODE_SCHEMAS[node.data.nodeType]?.output as IOKind | undefined
        const outputKind = kind && kind !== 'none' ? (kind as NodeResult['outputKind']) : undefined
        onUpdate(nodeId, { status: 'done', output, outputKind })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          onUpdate(nodeId, { status: 'error', error: 'Cancelled' })
          throw err
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        onUpdate(nodeId, { status: 'error', error: message })
        throw new WorkflowExecutionError(message, nodeId)
      }
    }))
  }
}
