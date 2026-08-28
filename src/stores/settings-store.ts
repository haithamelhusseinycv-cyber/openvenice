import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  isAllowedChatModel,
  isAllowedImageModel,
  isEnabledAppTab,
  resolveChatModel,
} from '../lib/allowed-models'

export type Tab = 'chat' | 'image' | 'audio' | 'music' | 'video' | 'embeddings' | 'workflows' | 'playground'

export function sanitizeSelectedModels(selected: Record<string, string> | undefined): Record<string, string> {
  const chat = isAllowedChatModel(selected?.chat) ? selected!.chat : DEFAULT_CHAT_MODEL_ID
  const image = isAllowedImageModel(selected?.image) ? selected!.image : DEFAULT_IMAGE_MODEL_ID
  return { chat, image }
}

export function sanitizeActiveTab(tab: unknown): Tab {
  return isEnabledAppTab(typeof tab === 'string' ? tab : undefined) ? tab as Tab : 'chat'
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
      setActiveTab: (tab) => set({ activeTab: sanitizeActiveTab(tab) }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      selectedModels: {
        chat: DEFAULT_CHAT_MODEL_ID,
        image: DEFAULT_IMAGE_MODEL_ID,
      },
      setSelectedModel: (tab, modelId) =>
        set((state) => ({
          selectedModels: sanitizeSelectedModels({ ...state.selectedModels, [tab]: modelId }),
        })),
      playgroundAgentModel: DEFAULT_CHAT_MODEL_ID,
      setPlaygroundAgentModel: (modelId) => set({ playgroundAgentModel: resolveChatModel(modelId) }),
    }),
    {
      name: 'venice-settings',
      version: 4,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as SettingsState
        const state = persisted as Partial<SettingsState>
        state.selectedModels = sanitizeSelectedModels(state.selectedModels)
        state.activeTab = sanitizeActiveTab(state.activeTab)
        state.playgroundAgentModel = resolveChatModel(state.playgroundAgentModel)
        return state as SettingsState
      },
    },
  ),
)
