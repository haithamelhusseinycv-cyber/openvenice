import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  isAllowedChatModel,
  isAllowedImageModel,
} from '../lib/allowed-models'

export type Tab = 'chat' | 'image' | 'audio' | 'music' | 'video' | 'embeddings' | 'workflows' | 'playground'

export function sanitizeSelectedModels(selected: Record<string, string> | undefined): Record<string, string> {
  const next = { ...(selected || {}) }
  if (!isAllowedChatModel(next.chat)) next.chat = DEFAULT_CHAT_MODEL_ID
  if (!isAllowedImageModel(next.image)) next.image = DEFAULT_IMAGE_MODEL_ID
  return next
}

interface SettingsState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  selectedModels: Record<string, string>
  setSelectedModel: (tab: string, modelId: string) => void
  playgroundAgentModel: string
  setPlaygroundAgentModel: (modelId: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      selectedModels: {
        chat: DEFAULT_CHAT_MODEL_ID,
        image: DEFAULT_IMAGE_MODEL_ID,
      },
      setSelectedModel: (tab, modelId) =>
        set((s) => ({
          selectedModels: sanitizeSelectedModels({ ...s.selectedModels, [tab]: modelId }),
        })),
      playgroundAgentModel: '',
      setPlaygroundAgentModel: (modelId) => set({ playgroundAgentModel: modelId }),
    }),
    {
      name: 'venice-settings',
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as SettingsState
        const s = persisted as Partial<SettingsState>
        s.selectedModels = sanitizeSelectedModels(s.selectedModels)
        return s as SettingsState
      },
    },
  ),
)
