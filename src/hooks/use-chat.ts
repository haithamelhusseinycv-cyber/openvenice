import { useCallback, useRef } from 'react'
import { venice } from '../lib/venice-client'
import { parseSSEStream } from '../lib/stream'
import { useChatStore } from '../stores/chat-store'
import { useProviderStore } from '../stores/provider-store'
import { lockChatSystemPrompt } from '../lib/defaults'
import { getDefaultAgentRegistry } from '../agent/runtime'
import { runQwenAgent } from '../agent/qwen-tool-loop'
import type { ChatCompletionRequest, ChatMessage, ContentPart } from '../types/venice'

export function useChat() {
  const abortRef = useRef<AbortController | null>(null)
  const {
    addMessage,
    appendToLastAssistant,
    appendReasoningToLastAssistant,
    addArtifactToLastAssistant,
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

      const provider = useProviderStore.getState()
      if (provider.chatProvider === 'qwen') {
        await runQwenAgent({
          config: { baseUrl: provider.qwenBaseUrl, apiKey: provider.qwenApiKey },
          model,
          messages,
          temperature,
          topP,
          maxTokens,
          registry: getDefaultAgentRegistry(),
          signal: abortController.signal,
          onModel: (servedModel) => setLastAssistantServedModel(convId, servedModel),
          onContent: (text) => appendToLastAssistant(convId, text),
          onReasoning: (text) => appendReasoningToLastAssistant(convId, text),
          onArtifact: (artifact) => {
            const mimeType = typeof artifact.metadata.mimeType === 'string'
              ? artifact.metadata.mimeType
              : undefined
            const format = typeof artifact.metadata.format === 'string'
              ? artifact.metadata.format
              : undefined
            // Raw RGB is an internal pipeline artifact for chaining into
            // Local Dream upscale; it cannot be rendered directly in chat.
            if (!mimeType?.startsWith('image/') || format === 'raw') return
            const url = artifact.data.startsWith('data:')
              ? artifact.data
              : `data:${mimeType};base64,${artifact.data}`
            addArtifactToLastAssistant(convId, {
              id: artifact.id,
              kind: 'image',
              url,
              mimeType,
              format,
              width: typeof artifact.metadata.width === 'number' ? artifact.metadata.width : undefined,
              height: typeof artifact.metadata.height === 'number' ? artifact.metadata.height : undefined,
              sourceTool: typeof artifact.metadata.sourceTool === 'string' ? artifact.metadata.sourceTool : undefined,
            })
          },
        })
        return
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
        if (chunk.model) setLastAssistantServedModel(convId, chunk.model)
        const delta = chunk.choices[0]?.delta as (typeof chunk.choices)[number]['delta'] & {
          reasoning?: string
          reasoning_text?: string
        }
        if (delta?.content) appendToLastAssistant(convId, delta.content)
        const reasoning = delta?.reasoning_content || delta?.reasoning || delta?.reasoning_text
        if (reasoning) appendReasoningToLastAssistant(convId, reasoning)
      }
    },
    [addArtifactToLastAssistant, appendToLastAssistant, appendReasoningToLastAssistant, setLastAssistantServedModel, veniceParams, temperature, topP, maxTokens],
  )

  const send = useCallback(
    async (userMessage: string, model: string, imageAttachments?: string[]) => {
      let convId = useChatStore.getState().activeConversationId
      if (!convId) convId = createConversation(model)

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
        // Provider/model routing is explicit. Do not silently fall back to a
        // different provider or model when the selected route fails.
        await streamResponse(convId, model, abortController)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        appendToLastAssistant(convId!, `\n\n[Error: ${message}]`)
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [addMessage, appendToLastAssistant, createConversation, setStreaming, streamResponse],
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
        await streamResponse(convId, model, abortController)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        appendToLastAssistant(convId, `\n\n[Error: ${message}]`)
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [addMessage, appendToLastAssistant, deleteMessage, setStreaming, streamResponse],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [setStreaming])

  return { send, stop, regenerate, isStreaming }
}
