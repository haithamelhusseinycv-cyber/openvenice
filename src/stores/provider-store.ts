import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import { probeGateway, type GatewayStatus } from '../lib/ai-gateway'
import { pickOpenModelId } from '../lib/open-models'

export type ChatProviderId = 'qwen' | 'venice'

/**
 * `auto` prefers the self-hosted open model whenever the same-origin gateway is
 * actually answering, and falls back to the configured external provider when
 * it is not. `manual` pins the user's explicit choice.
 */
export type ChatProviderMode = 'auto' | 'manual'

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
  chatProviderMode: ChatProviderMode
  qwenBaseUrl: string
  qwenModelId: string
  /** Optional per-session override. Production credentials stay server-side. */
  qwenApiKey: string
  /** Explicit user control over cross-provider fallback. Default: off. */
  fallbackEnabled: boolean
  /** Ephemeral gateway state. Never persisted. */
  gatewayStatus: GatewayStatus
  gatewayModels: string[]
  gatewayCheckedAt: number
  gatewayDetail: string
  setChatProvider: (provider: ChatProviderId) => void
  setChatProviderMode: (mode: ChatProviderMode) => void
  setQwenBaseUrl: (url: string) => void
  setQwenModelId: (modelId: string) => void
  setQwenApiKey: (key: string) => void
  clearQwenApiKey: () => void
  setFallbackEnabled: (enabled: boolean) => void
  refreshGateway: (options?: { force?: boolean }) => Promise<GatewayStatus>
}

const GATEWAY_RECHECK_MS = 30_000
let inFlightProbe: Promise<GatewayStatus> | null = null

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      chatProvider: 'qwen',
      chatProviderMode: 'auto',
      qwenBaseUrl: envValue('VITE_QWEN_BASE_URL'),
      qwenModelId: envValue('VITE_QWEN_MODEL_ID') || DEFAULT_QWEN_MODEL_ID,
      qwenApiKey: sessionValue(QWEN_SESSION_KEY),
      fallbackEnabled: false,
      gatewayStatus: 'unknown',
      gatewayModels: [],
      gatewayCheckedAt: 0,
      gatewayDetail: '',
      setChatProvider: (chatProvider) => set({ chatProvider, chatProviderMode: 'manual' }),
      setChatProviderMode: (chatProviderMode) => set({ chatProviderMode }),
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
      setFallbackEnabled: (fallbackEnabled) => set({ fallbackEnabled }),
      refreshGateway: async (options = {}) => {
        const state = get()
        if (!options.force && state.gatewayStatus !== 'unknown' && Date.now() - state.gatewayCheckedAt < GATEWAY_RECHECK_MS) {
          return state.gatewayStatus
        }
        if (inFlightProbe) return inFlightProbe

        inFlightProbe = probeGateway({ base: state.qwenBaseUrl })
          .then((probe) => {
            set({
              gatewayStatus: probe.status,
              gatewayModels: probe.models,
              gatewayCheckedAt: Date.now(),
              gatewayDetail: probe.detail || '',
            })
            return probe.status
          })
          .finally(() => {
            inFlightProbe = null
          })

        return inFlightProbe
      },
    }),
    {
      name: 'openvenice-provider-settings',
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as ProviderState
        const state = persisted as Partial<ProviderState>
        // Existing installs persisted a bare provider choice; treat it as a
        // manual pin so an explicit user decision is never silently overridden.
        state.chatProviderMode = state.chatProviderMode ?? 'manual'
        state.fallbackEnabled = state.fallbackEnabled ?? false
        return state as ProviderState
      },
      partialize: (state) => ({
        chatProvider: state.chatProvider,
        chatProviderMode: state.chatProviderMode,
        qwenBaseUrl: state.qwenBaseUrl,
        qwenModelId: state.qwenModelId,
        fallbackEnabled: state.fallbackEnabled,
      }),
    },
  ),
)

/** The open-model route needs a base URL and a target model id. */
export function isQwenReady(state = useProviderStore.getState()) {
  return state.qwenBaseUrl.trim().length >= 0 && state.qwenModelId.trim().length > 0
}

/**
 * The model id to actually send to the endpoint.
 *
 * `qwenModelId` is only a preference: discovery wins when the endpoint serves
 * something else, so a renamed or swapped model never breaks the route.
 */
export function effectiveOpenModelId(state = useProviderStore.getState()): string {
  return pickOpenModelId(state.gatewayModels, state.qwenModelId)
}

/**
 * Resolve the provider that will actually serve the next request.
 *
 * This is what stops the app from defaulting to an open-model route that has no
 * backend: in `auto` mode an unavailable gateway resolves to the external
 * provider instead of producing a send failure.
 */
export function resolveChatProvider(state = useProviderStore.getState()): ChatProviderId {
  if (state.chatProviderMode === 'manual') return state.chatProvider
  if (state.gatewayStatus === 'online') return 'qwen'
  if (state.gatewayStatus === 'disabled' || state.gatewayStatus === 'offline') return 'venice'
  return state.chatProvider
}
