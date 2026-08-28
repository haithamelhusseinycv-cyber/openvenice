import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChatMessage, Conversation, VeniceParameters } from '../types/venice'
import { generateId } from '../lib/utils'
import { createIndexedDBStorage } from '../lib/indexeddb-storage'
import { DEFAULT_CHAT_MAX_TOKENS, resolveChatModel } from '../lib/allowed-models'

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

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function sanitizeConversations(conversations: Conversation[] | undefined): Conversation[] {
  if (!Array.isArray(conversations)) return []
  return conversations.slice(0, 50).map((conversation) => ({
    ...conversation,
    model: resolveChatModel(conversation.model),
  }))
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      veniceParams: {
        include_venice_system_prompt: false,
        enable_web_search: 'off',
      },
      systemPrompt: '',
      temperature: 0.7,
      topP: 1,
      maxTokens: DEFAULT_CHAT_MAX_TOKENS,

      createConversation: (model) => {
        const id = generateId()
        const conversation: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          model: resolveChatModel(model),
          createdAt: Date.now(),
        }
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }))
        return id
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((conversation) => conversation.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            const updated = { ...conversation, messages: [...conversation.messages, message] }
            if (
              message.role === 'user' &&
              conversation.messages.length === 0 &&
              typeof message.content === 'string'
            ) {
              updated.title = message.content.slice(0, 50) || 'New Chat'
            }
            return updated
          }),
        })),

      appendToLastAssistant: (conversationId, token) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            const messages = [...conversation.messages]
            const last = messages[messages.length - 1]
            if (last?.role === 'assistant' && typeof last.content === 'string') {
              messages[messages.length - 1] = { ...last, content: last.content + token }
            }
            return { ...conversation, messages }
          }),
        })),

      appendReasoningToLastAssistant: (conversationId, token) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            const messages = [...conversation.messages]
            const last = messages[messages.length - 1]
            if (last?.role === 'assistant') {
              messages[messages.length - 1] = {
                ...last,
                reasoning_content: (last.reasoning_content || '') + token,
              }
            }
            return { ...conversation, messages }
          }),
        })),

      deleteMessage: (conversationId, index) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, messages: conversation.messages.filter((_, messageIndex) => messageIndex !== index) }
              : conversation,
          ),
        })),

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setVeniceParams: (params) => set((state) => ({ veniceParams: { ...state.veniceParams, ...params } })),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setTemperature: (temperature) => set({ temperature: clampNumber(temperature, 0.7, 0, 2) }),
      setTopP: (topP) => set({ topP: clampNumber(topP, 1, 0, 1) }),
      setMaxTokens: (maxTokens) => set({ maxTokens: Math.round(clampNumber(maxTokens, DEFAULT_CHAT_MAX_TOKENS, 256, 32768)) }),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get()
        return conversations.find((conversation) => conversation.id === activeConversationId)
      },
    }),
    {
      name: 'venice-chat',
      version: 5,
      storage: createJSONStorage(() => createIndexedDBStorage()),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted as ChatState
        const state = persisted as Partial<ChatState>
        state.conversations = sanitizeConversations(state.conversations)
        if (!state.veniceParams || typeof state.veniceParams !== 'object') {
          state.veniceParams = { include_venice_system_prompt: false, enable_web_search: 'off' }
        }
        if (version < 2) delete (state as Record<string, unknown>).isStreaming
        if (version < 3 && (state.maxTokens === undefined || state.maxTokens === 4096)) {
          state.maxTokens = DEFAULT_CHAT_MAX_TOKENS
        }
        state.temperature = clampNumber(state.temperature, 0.7, 0, 2)
        state.topP = clampNumber(state.topP, 1, 0, 1)
        state.maxTokens = Math.round(clampNumber(state.maxTokens, DEFAULT_CHAT_MAX_TOKENS, 256, 32768))
        if (state.activeConversationId && !state.conversations.some((conversation) => conversation.id === state.activeConversationId)) {
          state.activeConversationId = null
        }
        return state as ChatState
      },
      partialize: (state) => ({
        conversations: state.conversations.slice(0, 50),
        activeConversationId: state.activeConversationId,
        veniceParams: state.veniceParams,
        systemPrompt: state.systemPrompt,
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
      }),
    },
  ),
)
