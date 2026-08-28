import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import type { VeniceNodeData, NodeResult } from './workflow-store'
import { sanitizeWorkflowNodes } from './workflow-store'
import { applyPatches, type WorkflowPatch, type PatchResult } from '../lib/workflow-mutations'
import { createSafeStorage } from '../lib/safe-storage'

export interface PlaygroundActivity {
  tool: string
  /** Short human-readable summary, e.g. "added chat node 'research'" */
  summary: string
  ok: boolean
}

export interface PlaygroundMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  patches?: WorkflowPatch[]
  activity?: PlaygroundActivity[]
  error?: string
  pending?: boolean
}

type PlaygroundDraft = { nodes: Node<VeniceNodeData>[]; edges: Edge[] }

interface PlaygroundState {
  messages: PlaygroundMessage[]
  draft: PlaygroundDraft
  linkedWorkflowId: string | null
  isThinking: boolean
  runResults: Record<string, NodeResult>
  isRunning: boolean

  addMessage: (msg: PlaygroundMessage) => void
  updateMessage: (id: string, updates: Partial<PlaygroundMessage>) => void
  setThinking: (v: boolean) => void
  applyAgentPatches: (patches: readonly WorkflowPatch[]) => PatchResult
  resetDraft: () => void
  clearConversation: () => void
  setRunResults: (results: Record<string, NodeResult>) => void
  updateRunNode: (nodeId: string, result: Partial<NodeResult>) => void
  setIsRunning: (running: boolean) => void
  clearResults: () => void
  loadWorkflow: (workflowId: string, nodes: Node<VeniceNodeData>[], edges: Edge[]) => void
  unlinkWorkflow: () => void
}

function sanitizeDraft(draft: PlaygroundDraft): PlaygroundDraft {
  const nodes = sanitizeWorkflowNodes(Array.isArray(draft.nodes) ? draft.nodes : [])
  const ids = new Set(nodes.map((node) => node.id))
  const edges = (Array.isArray(draft.edges) ? draft.edges : []).filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  )
  return { nodes, edges }
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set, get) => ({
      messages: [],
      draft: { nodes: [], edges: [] },
      linkedWorkflowId: null,
      isThinking: false,
      runResults: {},
      isRunning: false,

      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((message) => (message.id === id ? { ...message, ...updates } : message)),
        })),
      setThinking: (value) => set({ isThinking: value }),
      applyAgentPatches: (patches) => {
        const draft = sanitizeDraft(get().draft)
        const result = applyPatches(draft, patches)
        const nodes = sanitizeWorkflowNodes(result.nodes)
        const next = { nodes, edges: result.edges }
        set({ draft: next, runResults: {} })
        return { ...result, nodes }
      },
      resetDraft: () => set({ draft: { nodes: [], edges: [] }, runResults: {}, linkedWorkflowId: null }),
      clearConversation: () => set({ messages: [], draft: { nodes: [], edges: [] }, runResults: {}, linkedWorkflowId: null }),
      setRunResults: (results) => set({ runResults: results }),
      updateRunNode: (nodeId, result) =>
        set((state) => ({
          runResults: { ...state.runResults, [nodeId]: { ...state.runResults[nodeId], ...result } as NodeResult },
        })),
      setIsRunning: (running) => set({ isRunning: running }),
      clearResults: () => set({ runResults: {} }),
      loadWorkflow: (workflowId, nodes, edges) => set({
        draft: sanitizeDraft({ nodes, edges }),
        linkedWorkflowId: workflowId,
        runResults: {},
        messages: [],
      }),
      unlinkWorkflow: () => set({ linkedWorkflowId: null }),
    }),
    {
      name: 'venice-playground',
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as PlaygroundState
        const state = persisted as Partial<PlaygroundState>
        if (state.draft && typeof state.draft === 'object') {
          state.draft = sanitizeDraft(state.draft as PlaygroundDraft)
        }
        if (Array.isArray(state.messages)) state.messages = state.messages.slice(-40)
        return state as PlaygroundState
      },
      partialize: (state) => ({
        messages: state.messages.slice(-40),
        draft: state.draft,
        linkedWorkflowId: state.linkedWorkflowId,
      }),
    },
  ),
)
