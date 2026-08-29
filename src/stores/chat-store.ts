import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChatMessage, Conversation, VeniceParameters } from '../types/venice'
import { generateId } from '../lib/utils'
import { createSafeStorage } from '../lib/safe-storage'
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  LOCKED_CHAT_MAX_TOKENS,
  LOCKED_CHAT_TEMPERATURE,
  LOCKED_CHAT_TOP_P,
  lockChatParams,
  lockChatSystemPrompt,
} from '../lib/defaults'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean
  veniceParams: VeniceParameters
  systemPrompt: string
  temperature: number
  topP: number
  maxTokens: number

  createConversation: (model: string) => string
  setActiveConversation: (id: string | null) => void
  deleteConversation: (id: string) => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  appendToLastAssistant: (conversationId: string, token: string) => void
  appendReasoningToLastAssistant: (conversationId: string, token: string) => void
  deleteMessage: (conversationId: string, index: number) => void
  setStreaming: (streaming: boolean) => void
  setVeniceParams: (params: Partial<VeniceParameters>) => void
  setSystemPrompt: (prompt: string) => void
  setTemperature: (t: number) => void
  setTopP: (p: number) => void
  setMaxTokens: (t: number) => void
  getActiveConversation: () => Conversation | undefined
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      veniceParams: lockChatParams(),
      systemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT,
      temperature: LOCKED_CHAT_TEMPERATURE,
      topP: LOCKED_CHAT_TOP_P,
      maxTokens: LOCKED_CHAT_MAX_TOKENS,

      createConversation: (model) => {
        const id = generateId()
        const conv: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          model,
          createdAt: Date.now(),
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: id,
        }))
        return id
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      deleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeConversationId:
            s.activeConversationId === id ? null : s.activeConversationId,
        })),

      addMessage: (conversationId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const updated = { ...c, messages: [...c.messages, message] }
            if (
              message.role === 'user' &&
              c.messages.length === 0 &&
              typeof message.content === 'string'
            ) {
              updated.title = message.content.slice(0, 50) || 'New Chat'
            }
            return updated
          }),
        })),

      appendToLastAssistant: (conversationId, token) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const msgs = [...c.messages]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant' && typeof last.content === 'string') {
              msgs[msgs.length - 1] = { ...last, content: last.content + token }
            }
            return { ...c, messages: msgs }
          }),
        })),

      appendReasoningToLastAssistant: (conversationId, token) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const msgs = [...c.messages]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, reasoning_content: (last.reasoning_content || '') + token }
            }
            return { ...c, messages: msgs }
          }),
        })),

      deleteMessage: (conversationId, index) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const msgs = c.messages.filter((_, i) => i !== index)
            return { ...c, messages: msgs }
          }),
        })),

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      setVeniceParams: (params) =>
        set((s) => ({ veniceParams: lockChatParams({ ...s.veniceParams, ...params }) })),

      setSystemPrompt: (prompt) => set({ systemPrompt: lockChatSystemPrompt(prompt) }),
      setTemperature: (t) => set({ temperature: t }),
      setTopP: (p) => set({ topP: p }),
      setMaxTokens: (t) => set({ maxTokens: t }),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get()
        return conversations.find((c) => c.id === activeConversationId)
      },
    }),
    {
      name: 'venice-chat',
      version: 9,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as ChatState
        const s = persisted as Partial<ChatState>
        if (Array.isArray(s.conversations)) s.conversations = s.conversations.slice(0, 50)
        s.veniceParams = lockChatParams(s.veniceParams)
        s.systemPrompt = lockChatSystemPrompt(s.systemPrompt)
        s.maxTokens = LOCKED_CHAT_MAX_TOKENS
        s.temperature = LOCKED_CHAT_TEMPERATURE
        s.topP = LOCKED_CHAT_TOP_P
        delete (s as Record<string, unknown>).isStreaming
        return s as ChatState
      },
      partialize: (state) => ({
        conversations: state.conversations.slice(0, 50),
        activeConversationId: state.activeConversationId,
        veniceParams: lockChatParams(state.veniceParams),
        systemPrompt: lockChatSystemPrompt(state.systemPrompt),
        temperature: LOCKED_CHAT_TEMPERATURE,
        topP: LOCKED_CHAT_TOP_P,
        maxTokens: LOCKED_CHAT_MAX_TOKENS,
      }),
    },
  ),
)
