import { useCallback, useRef } from 'react'
import { venice } from '../lib/venice-client'
import { parseSSEStream } from '../lib/stream'
import { useChatStore } from '../stores/chat-store'
import { lockChatSystemPrompt } from '../lib/defaults'
import {
  DEFAULT_CHAT_MODEL_ID,
  FALLBACK_CHAT_MODEL_ID,
} from '../lib/allowed-models'
import { shouldUseModelFallback } from '../lib/model-routing'
import type { ChatCompletionRequest, ChatMessage, ContentPart } from '../types/venice'

export function useChat() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    addMessage,
    appendToLastAssistant,
    appendReasoningToLastAssistant,
    setLastAssistantServedModel,
    deleteMessage,
    setStreaming,
    isStreaming,
    veniceParams,
    temperature,
    topP,
    maxTokens,
    createConversation,
  } = useChatStore()

  const streamResponse = useCallback(
    async (convId: string, model: string, abortController: AbortController) => {
      const conv = useChatStore.getState().conversations.find((c) => c.id === convId)
      if (!conv) return

      const messages = conv.messages.filter((m) => {
        if (typeof m.content === 'string') return m.content !== ''
        return true
      })
      const safeSystemPrompt = lockChatSystemPrompt(useChatStore.getState().systemPrompt)
      if (safeSystemPrompt) {
        messages.unshift({ role: 'system', content: safeSystemPrompt })
      }

      const body: ChatCompletionRequest = {
        model,
        messages,
        stream: true,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        venice_parameters: veniceParams,
      }

      const stream = await venice<ReadableStream<Uint8Array>>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
        stream: true,
        signal: abortController.signal,
      })

      for await (const chunk of parseSSEStream(stream, { signal: abortController.signal })) {
        if (chunk.model) {
          setLastAssistantServedModel(convId, chunk.model)
        }
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          appendToLastAssistant(convId, delta.content)
        }
        if (delta?.reasoning_content) {
          appendReasoningToLastAssistant(convId, delta.reasoning_content)
        }
      }
    },
    [appendToLastAssistant, appendReasoningToLastAssistant, setLastAssistantServedModel, veniceParams, temperature, topP, maxTokens],
  )

  const streamWithFallback = useCallback(
    async (convId: string, model: string, abortController: AbortController) => {
      try {
        await streamResponse(convId, model, abortController)
      } catch (error) {
        const conversation = useChatStore.getState().conversations.find((item) => item.id === convId)
        const last = conversation?.messages[conversation.messages.length - 1]
        const hasOutput = last?.role === 'assistant'
          && typeof last.content === 'string'
          && last.content.length > 0
        const canFallback = model === DEFAULT_CHAT_MODEL_ID
          && shouldUseModelFallback(error, { aborted: abortController.signal.aborted, hasOutput })
        if (!canFallback) throw error
        await streamResponse(convId, FALLBACK_CHAT_MODEL_ID, abortController)
      }
    },
    [streamResponse],
  )

  const send = useCallback(
    async (userMessage: string, model: string, imageAttachments?: string[]) => {
      let convId = useChatStore.getState().activeConversationId
      if (!convId) {
        convId = createConversation(model)
      }

      // Build user message — plain text or multimodal with images
      let userMsg: ChatMessage
      if (imageAttachments && imageAttachments.length > 0) {
        const parts: ContentPart[] = [
          { type: 'text', text: userMessage },
          ...imageAttachments.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ]
        userMsg = { role: 'user', content: parts }
      } else {
        userMsg = { role: 'user', content: userMessage }
      }

      addMessage(convId, userMsg)
      addMessage(convId, { role: 'assistant', content: '', requested_model: model })
      setStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        await streamWithFallback(convId, model, abortController)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        appendToLastAssistant(convId!, `\n\n[Error: ${message}]`)
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [addMessage, appendToLastAssistant, createConversation, setStreaming, streamWithFallback],
  )

  const regenerate = useCallback(
    async (model: string) => {
      const convId = useChatStore.getState().activeConversationId
      if (!convId) return
      const conv = useChatStore.getState().conversations.find((c) => c.id === convId)
      if (!conv) return

      const lastAssistantIdx = conv.messages.length - 1
      if (conv.messages[lastAssistantIdx]?.role === 'assistant') {
        deleteMessage(convId, lastAssistantIdx)
      }

      addMessage(convId, { role: 'assistant', content: '', requested_model: model })
      setStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        await streamWithFallback(convId, model, abortController)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        appendToLastAssistant(convId, `\n\n[Error: ${message}]`)
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [addMessage, appendToLastAssistant, deleteMessage, setStreaming, streamWithFallback],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [setStreaming])

  return { send, stop, regenerate, isStreaming }
}
