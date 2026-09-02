import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'
import type { VoiceLocale } from '../lib/voice-chat'

interface VoiceState {
  locale: VoiceLocale
  speakReplies: boolean
  autoSend: boolean
  setLocale: (locale: VoiceLocale) => void
  toggleLocale: () => void
  setSpeakReplies: (enabled: boolean) => void
  setAutoSend: (enabled: boolean) => void
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      locale: 'en-US',
      speakReplies: true,
      autoSend: true,
      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set((state) => ({ locale: state.locale === 'en-US' ? 'ar-EG' : 'en-US' })),
      setSpeakReplies: (speakReplies) => set({ speakReplies }),
      setAutoSend: (autoSend) => set({ autoSend }),
    }),
    {
      name: 'openvenice-voice-settings',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        locale: state.locale,
        speakReplies: state.speakReplies,
        autoSend: state.autoSend,
      }),
    },
  ),
)
