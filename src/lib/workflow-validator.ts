import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData } from '../stores/workflow-store'
import { NODE_SCHEMAS, NODE_TYPES, isInputCompatible, isIdealMatch } from './workflow-schema'
import { isAllowedChatModel, isAllowedImageModel } from './allowed-models'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

type WFGraph = { nodes: Node<VeniceNodeData>[]; edges: Edge[] }

function hasCycle(nodes: Node<VeniceNodeData>[], edges: Edge[]): boolean {
  const adj = new Map<string, string[]>()
  for (const node of nodes) adj.set(node.id, [])
  for (const edge of edges) adj.get(edge.source)?.push(edge.target)

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const node of nodes) color.set(node.id, WHITE)

  const visit = (id: string): boolean => {
    color.set(id, GRAY)
    for (const next of adj.get(id) ?? []) {
      const state = color.get(next)
      if (state === GRAY) return true
      if (state === WHITE && visit(next)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE && visit(node.id)) return true
  }
  return false
}

function getParam(data: VeniceNodeData, name: string): unknown {
  return (data as unknown as Record<string, unknown>)[name]
}

function isParamMissing(data: VeniceNodeData, name: string): boolean {
  const value = getParam(data, name)
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

function validateParamValue(
  node: Node<VeniceNodeData>,
  name: string,
  type: string,
  value: unknown,
  min?: number,
  max?: number,
  enumValues?: readonly string[],
): ValidationIssue | null {
  const prefix = `${NODE_SCHEMAS[node.data.nodeType]?.label ?? node.data.nodeType}: "${name}"`

  if (enumValues) {
    if (typeof value !== 'string' || !enumValues.includes(value)) {
      return { severity: 'error', nodeId: node.id, message: `${prefix} must be one of: ${enumValues.filter(Boolean).join(', ')}.` }
    }
    return null
  }

  if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { severity: 'error', nodeId: node.id, message: `${prefix} must be a finite number.` }
    }
    if (min !== undefined && value < min) {
      return { severity: 'error', nodeId: node.id, message: `${prefix} must be at least ${min}.` }
    }
    if (max !== undefined && value > max) {
      return { severity: 'error', nodeId: node.id, message: `${prefix} must be at most ${max}.` }
    }
    return null
  }

  if (type === 'boolean' && typeof value !== 'boolean') {
    return { severity: 'error', nodeId: node.id, message: `${prefix} must be true or false.` }
  }

  if ((type === 'string' || type === 'text') && typeof value !== 'string') {
    return { severity: 'error', nodeId: node.id, message: `${prefix} must be text.` }
  }

  return null
}

export function validateWorkflow({ nodes, edges }: WFGraph): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const nodeIds = new Set(nodes.map((node) => node.id))

  if (nodes.length === 0) {
    warnings.push({ severity: 'warning', message: 'Workflow is empty.' })
  } else if (!nodes.some((node) => node.data.nodeType === 'output')) {
    warnings.push({ severity: 'warning', message: 'Workflow has no Output node, so final results may be easy to miss.' })
  }

  for (const node of nodes) {
    const schema = NODE_SCHEMAS[node.data?.nodeType]
    if (!schema) {
      errors.push({ severity: 'error', nodeId: node.id, message: `Unknown node type: ${String(node.data?.nodeType)}` })
      continue
    }
    if (!(NODE_TYPES as readonly string[]).includes(node.data.nodeType)) {
      errors.push({
        severity: 'error',
        nodeId: node.id,
        message: `${schema.label} nodes are disabled in this build. Use Chat and Image Gen only.`,
      })
      continue
    }

    for (const param of schema.params) {
      const missing = isParamMissing(node.data, param.name)
      if (param.required && missing) {
        const hasInboundText = schema.input !== 'none' && edges.some((edge) => edge.target === node.id)
        const fillableFromInput = (param.name === 'prompt' || param.name === 'inputText') && hasInboundText
        if (!fillableFromInput) {
          errors.push({
            severity: 'error',
            nodeId: node.id,
            message: `${schema.label}: missing required "${param.name}".`,
          })
        }
        continue
      }
      if (missing) continue

      const issue = validateParamValue(
        node,
        param.name,
        param.type,
        getParam(node.data, param.name),
        param.min,
        param.max,
        param.enumValues,
      )
      if (issue) errors.push(issue)
    }

    if (node.data.nodeType === 'chat' && !isAllowedChatModel(node.data.model)) {
      errors.push({ severity: 'error', nodeId: node.id, message: `LLM model "${node.data.model}" is not allowlisted.` })
    }
    if (node.data.nodeType === 'imageGen' && !isAllowedImageModel(node.data.model)) {
      errors.push({ severity: 'error', nodeId: node.id, message: `Image Gen model "${node.data.model}" is not allowlisted.` })
    }

    const incoming = edges.filter((edge) => edge.target === node.id)
    if (schema.input === 'none') {
      for (const edge of incoming) {
        errors.push({ severity: 'error', edgeId: edge.id, message: `${schema.label} does not accept inputs.` })
      }
    } else if (incoming.length === 0) {
      if (schema.type === 'output') {
        warnings.push({ severity: 'warning', nodeId: node.id, message: 'Output: no upstream input connected.' })
      } else {
        const needsPrompt = schema.params.some((param) => param.name === 'prompt' && param.required)
        if (!needsPrompt || isParamMissing(node.data, 'prompt')) {
          warnings.push({ severity: 'warning', nodeId: node.id, message: `${schema.label}: no upstream input connected.` })
        }
      }
    }

    if (schema.output === 'none') {
      const outgoing = edges.filter((edge) => edge.source === node.id)
      for (const edge of outgoing) {
        errors.push({ severity: 'error', edgeId: edge.id, message: `${schema.label} has no output and cannot feed another node.` })
      }
    }
  }

  const seenConnections = new Set<string>()
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({ severity: 'error', edgeId: edge.id, message: `Edge source ${edge.source} does not exist.` })
      continue
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({ severity: 'error', edgeId: edge.id, message: `Edge target ${edge.target} does not exist.` })
      continue
    }
    if (edge.source === edge.target) {
      errors.push({ severity: 'error', edgeId: edge.id, message: 'Self-loops are not allowed.' })
      continue
    }

    const connectionKey = `${edge.source}\u0000${edge.target}`
    if (seenConnections.has(connectionKey)) {
      errors.push({ severity: 'error', edgeId: edge.id, message: 'Duplicate connection between the same two nodes.' })
      continue
    }
    seenConnections.add(connectionKey)

    const source = nodes.find((node) => node.id === edge.source)
    const target = nodes.find((node) => node.id === edge.target)
    if (!source || !target) continue
    const sourceSchema = NODE_SCHEMAS[source.data.nodeType]
    const targetSchema = NODE_SCHEMAS[target.data.nodeType]
    if (!sourceSchema || !targetSchema) continue
    if (!isInputCompatible(sourceSchema.output, targetSchema.input)) {
      errors.push({
        severity: 'error',
        edgeId: edge.id,
        message: `${sourceSchema.label} (${sourceSchema.output}) cannot connect to ${targetSchema.label} (${targetSchema.input}).`,
      })
    } else if (!isIdealMatch(sourceSchema.output, targetSchema.input)) {
      warnings.push({
        severity: 'warning',
        edgeId: edge.id,
        message: `${sourceSchema.label} outputs ${sourceSchema.output}; ${targetSchema.label} expects ${targetSchema.input}. Conversion may be lossy.`,
      })
    }
  }

  if (hasCycle(nodes, edges)) {
    errors.push({ severity: 'error', message: 'Workflow contains a cycle.' })
  }

  return { ok: errors.length === 0, errors, warnings }
}
