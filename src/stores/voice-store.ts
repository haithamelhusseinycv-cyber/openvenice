import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import type { VoiceLocale } from '../lib/voice-chat'

export type NourTtsProvider = 'voicetut' | 'venice'

const DEFAULT_VOICETUT_BASE_URL = (import.meta.env.VITE_VOICETUT_BASE_URL as string | undefined)?.trim() || ''

interface VoiceState {
  locale: VoiceLocale
  speakReplies: boolean
  autoSend: boolean
  ttsProvider: NourTtsProvider
  ttsVoice: string
  voiceTutBaseUrl: string
  voiceRate: number
  pendingInputLocale?: VoiceLocale
  setLocale: (locale: VoiceLocale) => void
  toggleLocale: () => void
  setSpeakReplies: (enabled: boolean) => void
  setAutoSend: (enabled: boolean) => void
  setTtsProvider: (provider: NourTtsProvider) => void
  setTtsVoice: (voice: string) => void
  setVoiceTutBaseUrl: (baseUrl: string) => void
  setVoiceRate: (rate: number) => void
  markNextInputVoice: (locale: VoiceLocale) => void
  consumePendingInputLocale: () => VoiceLocale | undefined
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set, get) => ({
      locale: 'en-US',
      speakReplies: true,
      autoSend: true,
      ttsProvider: 'voicetut',
      ttsVoice: 'Omnia',
      voiceTutBaseUrl: DEFAULT_VOICETUT_BASE_URL,
      voiceRate: 0.95,
      pendingInputLocale: undefined,
      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set((state) => ({ locale: state.locale === 'en-US' ? 'ar-EG' : 'en-US' })),
      setSpeakReplies: (speakReplies) => set({ speakReplies }),
      setAutoSend: (autoSend) => set({ autoSend }),
      setTtsProvider: (ttsProvider) => set({ ttsProvider }),
      setTtsVoice: (ttsVoice) => set({ ttsVoice: ttsVoice.trim() || 'Omnia' }),
      setVoiceTutBaseUrl: (voiceTutBaseUrl) => set({ voiceTutBaseUrl: voiceTutBaseUrl.trim().replace(/\/$/, '') }),
      setVoiceRate: (voiceRate) => set({ voiceRate: Math.min(2, Math.max(0.5, voiceRate)) }),
      markNextInputVoice: (pendingInputLocale) => set({ pendingInputLocale }),
      consumePendingInputLocale: () => {
        const pending = get().pendingInputLocale
        set({ pendingInputLocale: undefined })
        return pending
      },
    }),
    {
      name: 'openvenice-voice-settings',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        locale: state.locale,
        speakReplies: state.speakReplies,
        autoSend: state.autoSend,
        ttsProvider: state.ttsProvider,
        ttsVoice: state.ttsVoice,
        voiceTutBaseUrl: state.voiceTutBaseUrl,
        voiceRate: state.voiceRate,
      }),
    },
  ),
)
