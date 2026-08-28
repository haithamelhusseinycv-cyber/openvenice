import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData, VeniceNodeType } from '../stores/workflow-store'
import { NODE_SCHEMAS, NODE_TYPES } from './workflow-schema'
import { isAllowedChatModel, isAllowedImageModel } from './allowed-models'
import { generateId } from './utils'

export type WorkflowPatch =
  | { op: 'add_node'; nodeType: VeniceNodeType; id?: string; position?: { x: number; y: number }; params?: Partial<VeniceNodeData> }
  | { op: 'remove_node'; id: string }
  | { op: 'set_params'; id: string; params: Partial<VeniceNodeData> }
  | { op: 'move_node'; id: string; position: { x: number; y: number } }
  | { op: 'connect'; source: string; target: string; id?: string }
  | { op: 'disconnect'; id: string }
  | { op: 'clear' }

export interface PatchResult {
  nodes: Node<VeniceNodeData>[]
  edges: Edge[]
  addedNodeId?: string
  addedEdgeId?: string
}

type WFGraph = { nodes: Node<VeniceNodeData>[]; edges: Edge[] }

const NODE_W = 280
const NODE_H = 180
const COL_GAP = 60
const ROW_GAP = 60

function isEnabledNodeType(nodeType: VeniceNodeType): boolean {
  return (NODE_TYPES as readonly string[]).includes(nodeType)
}

function defaultDataFor(nodeType: VeniceNodeType): VeniceNodeData {
  const schema = NODE_SCHEMAS[nodeType]
  const data: VeniceNodeData = {
    label: schema?.label ?? nodeType,
    nodeType,
    model: '',
    prompt: '',
  }
  for (const param of schema?.params ?? []) {
    if (param.default !== undefined) {
      (data as unknown as Record<string, unknown>)[param.name] = param.default
    }
  }
  return data
}

function sanitizePatchParams(
  nodeType: VeniceNodeType,
  params: Partial<VeniceNodeData> | undefined,
): Partial<VeniceNodeData> {
  if (!params) return {}
  const schema = NODE_SCHEMAS[nodeType]
  if (!schema || !isEnabledNodeType(nodeType)) {
    throw new Error(`${nodeType} nodes are disabled in this build.`)
  }

  const raw = params as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const param of schema.params) {
    const value = raw[param.name]
    if (value === undefined) continue

    if (param.enumValues) {
      if (typeof value !== 'string' || !param.enumValues.includes(value)) {
        throw new Error(`Invalid ${nodeType}.${param.name}. Expected one of: ${param.enumValues.filter(Boolean).join(', ')}.`)
      }
      sanitized[param.name] = value
      continue
    }

    if (param.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${nodeType}.${param.name} must be a finite number.`)
      }
      if (param.min !== undefined && value < param.min) {
        throw new Error(`${nodeType}.${param.name} must be at least ${param.min}.`)
      }
      if (param.max !== undefined && value > param.max) {
        throw new Error(`${nodeType}.${param.name} must be at most ${param.max}.`)
      }
      sanitized[param.name] = value
      continue
    }

    if (param.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${nodeType}.${param.name} must be boolean.`)
      sanitized[param.name] = value
      continue
    }

    if (typeof value !== 'string') {
      throw new Error(`${nodeType}.${param.name} must be text.`)
    }

    if (param.name === 'model') {
      if (nodeType === 'chat' && !isAllowedChatModel(value)) {
        throw new Error(`Model '${value}' is not allowlisted for Chat.`)
      }
      if (nodeType === 'imageGen' && !isAllowedImageModel(value)) {
        throw new Error(`Model '${value}' is not allowlisted for Image Gen.`)
      }
    }

    sanitized[param.name] = value
  }

  return sanitized as Partial<VeniceNodeData>
}

/**
 * Layered auto-layout. Walks the DAG, places each node at its topological depth,
 * and centers siblings at each level. Falls back to a sensible grid when no edges
 * exist yet.
 */
export function autoLayout(nodes: Node<VeniceNodeData>[], edges: Edge[]): Node<VeniceNodeData>[] {
  if (nodes.length === 0) return nodes

  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adj.set(node.id, [])
  }
  for (const edge of edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue
    adj.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const level = new Map<string, number>()
  const queue = nodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  for (const id of queue) level.set(id, 0)
  const remaining = new Map(inDegree)
  while (queue.length > 0) {
    const id = queue.shift()!
    const currentLevel = level.get(id) ?? 0
    for (const child of adj.get(id) ?? []) {
      level.set(child, Math.max(level.get(child) ?? 0, currentLevel + 1))
      const nextDegree = (remaining.get(child) ?? 1) - 1
      remaining.set(child, nextDegree)
      if (nextDegree === 0) queue.push(child)
    }
  }
  for (const node of nodes) if (!level.has(node.id)) level.set(node.id, 0)

  const byLevel = new Map<number, string[]>()
  for (const node of nodes) {
    const currentLevel = level.get(node.id) ?? 0
    if (!byLevel.has(currentLevel)) byLevel.set(currentLevel, [])
    byLevel.get(currentLevel)!.push(node.id)
  }

  const maxRowCount = Math.max(...Array.from(byLevel.values()).map((row) => row.length))
  const layoutWidth = maxRowCount * (NODE_W + COL_GAP)

  const positions = new Map<string, { x: number; y: number }>()
  for (const [currentLevel, ids] of byLevel) {
    const rowWidth = ids.length * (NODE_W + COL_GAP) - COL_GAP
    const startX = (layoutWidth - rowWidth) / 2
    ids.forEach((id, index) => {
      positions.set(id, {
        x: startX + index * (NODE_W + COL_GAP),
        y: 40 + currentLevel * (NODE_H + ROW_GAP),
      })
    })
  }

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }))
}

function autoPositionFallback(existing: Node<VeniceNodeData>[]): { x: number; y: number } {
  return { x: 280, y: 40 + existing.length * (NODE_H + ROW_GAP) }
}

export function applyPatch(graph: WFGraph, patch: WorkflowPatch): PatchResult {
  const { nodes, edges } = graph

  switch (patch.op) {
    case 'add_node': {
      if (!NODE_SCHEMAS[patch.nodeType] || !isEnabledNodeType(patch.nodeType)) {
        throw new Error(`Unknown or disabled node type: ${patch.nodeType}`)
      }
      const id = patch.id ?? generateId()
      if (nodes.some((node) => node.id === id)) throw new Error(`Node id already exists: ${id}`)
      const position = patch.position ?? autoPositionFallback(nodes)
      const data: VeniceNodeData = {
        ...defaultDataFor(patch.nodeType),
        ...sanitizePatchParams(patch.nodeType, patch.params),
      }
      const node: Node<VeniceNodeData> = { id, type: 'venice', position, data }
      return { nodes: [...nodes, node], edges, addedNodeId: id }
    }

    case 'remove_node': {
      if (!nodes.some((node) => node.id === patch.id)) throw new Error(`Node not found: ${patch.id}`)
      return {
        nodes: nodes.filter((node) => node.id !== patch.id),
        edges: edges.filter((edge) => edge.source !== patch.id && edge.target !== patch.id),
      }
    }

    case 'set_params': {
      const node = nodes.find((candidate) => candidate.id === patch.id)
      if (!node) throw new Error(`Node not found: ${patch.id}`)
      const params = sanitizePatchParams(node.data.nodeType, patch.params)
      return {
        nodes: nodes.map((candidate) =>
          candidate.id === patch.id ? { ...candidate, data: { ...candidate.data, ...params } } : candidate,
        ),
        edges,
      }
    }

    case 'move_node': {
      if (!nodes.some((node) => node.id === patch.id)) throw new Error(`Node not found: ${patch.id}`)
      if (!Number.isFinite(patch.position.x) || !Number.isFinite(patch.position.y)) {
        throw new Error('Node position must contain finite x/y coordinates.')
      }
      return {
        nodes: nodes.map((node) => (node.id === patch.id ? { ...node, position: patch.position } : node)),
        edges,
      }
    }

    case 'connect': {
      if (!nodes.some((node) => node.id === patch.source)) throw new Error(`Source node not found: ${patch.source}`)
      if (!nodes.some((node) => node.id === patch.target)) throw new Error(`Target node not found: ${patch.target}`)
      if (patch.source === patch.target) throw new Error('Cannot connect a node to itself.')
      if (edges.some((edge) => edge.source === patch.source && edge.target === patch.target)) {
        throw new Error('These nodes are already connected.')
      }
      const id = patch.id ?? `e-${patch.source}-${patch.target}-${generateId().slice(0, 6)}`
      if (edges.some((edge) => edge.id === id)) throw new Error(`Edge id already exists: ${id}`)
      const edge: Edge = { id, source: patch.source, target: patch.target, animated: true }
      return { nodes, edges: [...edges, edge], addedEdgeId: id }
    }

    case 'disconnect': {
      if (!edges.some((edge) => edge.id === patch.id)) throw new Error(`Edge not found: ${patch.id}`)
      return { nodes, edges: edges.filter((edge) => edge.id !== patch.id) }
    }

    case 'clear':
      return { nodes: [], edges: [] }
  }
}

export function applyPatches(graph: WFGraph, patches: readonly WorkflowPatch[]): PatchResult {
  let current: WFGraph = graph
  let lastAddedNodeId: string | undefined
  let lastAddedEdgeId: string | undefined
  for (const patch of patches) {
    const result = applyPatch(current, patch)
    current = { nodes: result.nodes, edges: result.edges }
    if (result.addedNodeId) lastAddedNodeId = result.addedNodeId
    if (result.addedEdgeId) lastAddedEdgeId = result.addedEdgeId
  }
  const laidOut = autoLayout(current.nodes, current.edges)
  return { nodes: laidOut, edges: current.edges, addedNodeId: lastAddedNodeId, addedEdgeId: lastAddedEdgeId }
}
