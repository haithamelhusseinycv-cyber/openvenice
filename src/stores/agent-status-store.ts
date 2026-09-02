import { create } from 'zustand'

export type AgentToolActivityState = 'running' | 'success' | 'error'

export interface AgentToolActivity {
  id: string
  toolId: string
  state: AgentToolActivityState
  startedAt: number
  finishedAt?: number
}

interface AgentStatusState {
  activitiesByConversation: Record<string, AgentToolActivity[]>
  startTool: (conversationId: string, toolId: string) => string
  finishTool: (conversationId: string, toolId: string, ok: boolean) => void
  clearConversation: (conversationId: string) => void
}

function activityId(toolId: string) {
  return `${toolId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
}

export function agentToolLabel(toolId: string) {
  const labels: Record<string, string> = {
    'localdream.info': 'Local Dream status',
    'localdream.list_models': 'Local Dream models',
    'localdream.select_model': 'Select Local Dream model',
    'localdream.generate': 'Local Dream image',
    'localdream.upscale': 'Local Dream upscale',
    'localdream.stop': 'Stop Local Dream',
    'facefusion.status': 'FaceFusion status',
    'facefusion.list_models': 'FaceFusion models',
    'facefusion.detect_faces': 'Detect faces',
    'facefusion.swap_face': 'FaceFusion swap',
    'facefusion.enhance_face': 'Face enhancement',
    'facefusion.enhance_image': 'Image enhancement',
    'facefusion.cancel': 'Cancel FaceFusion',
  }
  return labels[toolId] || toolId.replace(/[._]/g, ' ')
}

export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  activitiesByConversation: {},

  startTool: (conversationId, toolId) => {
    const id = activityId(toolId)
    set((state) => ({
      activitiesByConversation: {
        ...state.activitiesByConversation,
        [conversationId]: [
          ...(state.activitiesByConversation[conversationId] || []).slice(-7),
          { id, toolId, state: 'running', startedAt: Date.now() },
        ],
      },
    }))
    return id
  },

  finishTool: (conversationId, toolId, ok) => {
    set((state) => {
      const current = state.activitiesByConversation[conversationId] || []
      let finished = false
      const next = [...current]
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const activity = next[index]
        if (!finished && activity.toolId === toolId && activity.state === 'running') {
          next[index] = {
            ...activity,
            state: ok ? 'success' : 'error',
            finishedAt: Date.now(),
          }
          finished = true
        }
      }
      return {
        activitiesByConversation: {
          ...state.activitiesByConversation,
          [conversationId]: next,
        },
      }
    })
  },

  clearConversation: (conversationId) => {
    set((state) => {
      const next = { ...state.activitiesByConversation }
      delete next[conversationId]
      return { activitiesByConversation: next }
    })
  },
}))
