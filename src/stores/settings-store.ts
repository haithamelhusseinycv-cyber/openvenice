import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import type { NourLanguageMode } from '../lib/nour-character'
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  isAllowedChatModel,
  isAllowedImageModel,
  isVisibleTab,
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
  nourLanguageMode: NourLanguageMode
  setNourLanguageMode: (mode: NourLanguageMode) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: isVisibleTab(tab) ? tab : 'chat' }),
      sidebarOpen: true,
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
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
      nourLanguageMode: 'american-egyptian',
      setNourLanguageMode: (mode) => set({ nourLanguageMode: mode }),
    }),
    {
      name: 'venice-settings',
      version: 8,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as SettingsState
        const s = persisted as Partial<SettingsState>
        // Adopt the new preferred Qwen once. Users can still choose the Qwen
        // 3.6 backup manually after this migration has completed.
        s.selectedModels = { ...s.selectedModels, chat: DEFAULT_CHAT_MODEL_ID }
        s.selectedModels = sanitizeSelectedModels(s.selectedModels)
        if (!isVisibleTab(s.activeTab)) s.activeTab = 'chat'
        // Reset stale agent selections once so Noor adopts Qwen 3.8 first.
        s.playgroundAgentModel = ''
        if (s.nourLanguageMode !== 'american-egyptian' && s.nourLanguageMode !== 'cairo-street') {
          s.nourLanguageMode = 'american-egyptian'
        }
        return s as SettingsState
      },
      partialize: (state) => ({
        activeTab: isVisibleTab(state.activeTab) ? state.activeTab : 'chat',
        sidebarOpen: state.sidebarOpen,
        selectedModels: sanitizeSelectedModels(state.selectedModels),
        playgroundAgentModel: state.playgroundAgentModel,
        nourLanguageMode: state.nourLanguageMode,
      }),
    },
  ),
)
