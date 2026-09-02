import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'

export type ChatProviderId = 'qwen' | 'venice'

export const DEFAULT_QWEN_MODEL_ID = 'qwen3-vl-30b-a3b-thinking-abliterated'
const QWEN_SESSION_KEY = 'openvenice-qwen-api-key'

function sessionValue(key: string) {
  try {
    return sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function envValue(name: 'VITE_QWEN_BASE_URL' | 'VITE_QWEN_MODEL_ID') {
  const env = import.meta.env as Record<string, string | undefined>
  return (env[name] || '').trim()
}

interface ProviderState {
  chatProvider: ChatProviderId
  qwenBaseUrl: string
  qwenModelId: string
  qwenApiKey: string
  setChatProvider: (provider: ChatProviderId) => void
  setQwenBaseUrl: (url: string) => void
  setQwenModelId: (modelId: string) => void
  setQwenApiKey: (key: string) => void
  clearQwenApiKey: () => void
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      chatProvider: 'qwen',
      qwenBaseUrl: envValue('VITE_QWEN_BASE_URL'),
      qwenModelId: envValue('VITE_QWEN_MODEL_ID') || DEFAULT_QWEN_MODEL_ID,
      qwenApiKey: sessionValue(QWEN_SESSION_KEY),
      setChatProvider: (chatProvider) => set({ chatProvider }),
      setQwenBaseUrl: (qwenBaseUrl) => set({ qwenBaseUrl: qwenBaseUrl.trim() }),
      setQwenModelId: (qwenModelId) => set({ qwenModelId: qwenModelId.trim() || DEFAULT_QWEN_MODEL_ID }),
      setQwenApiKey: (qwenApiKey) => {
        try {
          if (qwenApiKey) sessionStorage.setItem(QWEN_SESSION_KEY, qwenApiKey)
          else sessionStorage.removeItem(QWEN_SESSION_KEY)
        } catch {
          // Session persistence is optional; in-memory state still works.
        }
        set({ qwenApiKey })
      },
      clearQwenApiKey: () => {
        try { sessionStorage.removeItem(QWEN_SESSION_KEY) } catch { /* noop */ }
        set({ qwenApiKey: '' })
      },
    }),
    {
      name: 'openvenice-provider-settings',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        chatProvider: state.chatProvider,
        qwenBaseUrl: state.qwenBaseUrl,
        qwenModelId: state.qwenModelId,
      }),
    },
  ),
)

export function isQwenReady(state = useProviderStore.getState()) {
  return state.qwenBaseUrl.trim().length > 0 && state.qwenModelId.trim().length > 0
}
