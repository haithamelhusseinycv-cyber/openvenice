import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import { generateId } from '../lib/utils'
import { applyPatches, type WorkflowPatch, type PatchResult } from '../lib/workflow-mutations'
import { createSafeStorage } from '../lib/safe-storage'
import {
  DEFAULT_CHAT_MAX_TOKENS,
  resolveChatModel,
  resolveImageModel,
} from '../lib/allowed-models'

export type VeniceNodeType = 'chat' | 'imageGen' | 'tts' | 'music' | 'video' | 'textInput' | 'output'

export interface VeniceNodeData extends Record<string, unknown> {
  label: string
  nodeType: VeniceNodeType
  model: string
  prompt: string
  // Chat-specific
  temperature?: number
  maxTokens?: number
  webSearch?: 'off' | 'on' | 'auto'
  // Image-specific
  negativePrompt?: string
  steps?: number
  aspectRatio?: string
  hideWatermark?: boolean
  width?: number
  height?: number
  // Legacy disabled-node fields are retained so old saved workflows can render and be removed.
  voice?: string
  speed?: number
  responseFormat?: string
  duration?: number
  instrumental?: boolean
  lyrics?: string
  videoDuration?: string
  videoResolution?: string
  videoAspectRatio?: string
  // Text input
  inputText?: string
}

export interface Workflow {
  id: string
  name: string
  nodes: Node<VeniceNodeData>[]
  edges: Edge[]
  createdAt: number
}

export type NodeResult = {
  nodeId: string
  status: 'pending' | 'running' | 'done' | 'error'
  output?: string
  outputKind?: 'text' | 'image' | 'audio' | 'video'
  error?: string
}

interface WorkflowState {
  workflows: Workflow[]
  activeWorkflowId: string | null
  runResults: Record<string, NodeResult>
  isRunning: boolean

  createWorkflow: (name: string) => string
  updateWorkflow: (id: string, updates: Partial<Pick<Workflow, 'name' | 'nodes' | 'edges'>>) => void
  deleteWorkflow: (id: string) => void
  setActiveWorkflow: (id: string | null) => void
  setRunResults: (results: Record<string, NodeResult>) => void
  updateNodeResult: (nodeId: string, result: Partial<NodeResult>) => void
  setIsRunning: (running: boolean) => void
  clearResults: () => void
  applyPatches: (workflowId: string, patches: readonly WorkflowPatch[]) => PatchResult
}

function sanitizeNodeData(data: VeniceNodeData): VeniceNodeData {
  const next = { ...data }

  if (next.nodeType === 'chat') {
    next.model = resolveChatModel(next.model)
    if (next.maxTokens === undefined || next.maxTokens === 4096) {
      next.maxTokens = DEFAULT_CHAT_MAX_TOKENS
    }
  } else if (next.nodeType === 'imageGen') {
    next.model = resolveImageModel(next.model)
    delete next.style
  } else if (next.nodeType === 'textInput' || next.nodeType === 'output') {
    next.model = ''
  }

  return next
}

function sanitizeNodes(nodes: Node<VeniceNodeData>[]): Node<VeniceNodeData>[] {
  return nodes.map((node) => ({ ...node, data: sanitizeNodeData(node.data) }))
}

function sanitizeWorkflow(workflow: Workflow): Workflow {
  return { ...workflow, nodes: sanitizeNodes(workflow.nodes) }
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      workflows: [],
      activeWorkflowId: null,
      runResults: {},
      isRunning: false,

      createWorkflow: (name) => {
        const id = generateId()
        const workflow: Workflow = {
          id,
          name,
          nodes: [],
          edges: [],
          createdAt: Date.now(),
        }
        set((state) => ({
          workflows: [workflow, ...state.workflows],
          activeWorkflowId: id,
        }))
        return id
      },

      updateWorkflow: (id, updates) =>
        set((state) => ({
          workflows: state.workflows.map((workflow) => {
            if (workflow.id !== id) return workflow
            const next = { ...workflow, ...updates }
            if (updates.nodes) next.nodes = sanitizeNodes(updates.nodes)
            return next
          }),
        })),

      deleteWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((workflow) => workflow.id !== id),
          activeWorkflowId: state.activeWorkflowId === id ? null : state.activeWorkflowId,
        })),

      setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

      setRunResults: (results) => set({ runResults: results }),

      updateNodeResult: (nodeId, result) =>
        set((state) => ({
          runResults: { ...state.runResults, [nodeId]: { ...state.runResults[nodeId], ...result } as NodeResult },
        })),

      setIsRunning: (running) => set({ isRunning: running }),

      clearResults: () => set({ runResults: {} }),

      applyPatches: (workflowId, patches) => {
        const workflow = get().workflows.find((candidate) => candidate.id === workflowId)
        if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)
        const result = applyPatches({ nodes: workflow.nodes, edges: workflow.edges }, patches)
        const nodes = sanitizeNodes(result.nodes)
        set((state) => ({
          workflows: state.workflows.map((candidate) =>
            candidate.id === workflowId ? { ...candidate, nodes, edges: result.edges } : candidate,
          ),
        }))
        return { ...result, nodes }
      },
    }),
    {
      name: 'venice-workflows',
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as WorkflowState
        const state = persisted as Partial<WorkflowState>
        if (Array.isArray(state.workflows)) {
          state.workflows = state.workflows.slice(0, 20).map(sanitizeWorkflow)
        }
        if (state.activeWorkflowId && !state.workflows?.some((workflow) => workflow.id === state.activeWorkflowId)) {
          state.activeWorkflowId = null
        }
        return state as WorkflowState
      },
      partialize: (state) => ({
        workflows: state.workflows.slice(0, 20),
        activeWorkflowId: state.activeWorkflowId,
      }),
    },
  ),
)
