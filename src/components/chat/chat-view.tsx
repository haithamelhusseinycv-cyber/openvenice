import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useProviderStore } from '../../stores/provider-store'
import { useModels } from '../../hooks/use-models'
import { useChat } from '../../hooks/use-chat'
import { useAuthStore } from '../../stores/auth-store'
import { DEFAULT_CHAT_MODEL_ID, isAllowedChatModel } from '../../lib/allowed-models'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { VeniceParams } from './venice-params'
import { VeniceLogo } from '../ui/logo'
import { ChatHistoryDialog } from './chat-history-dialog'
import { toast } from '../../stores/toast-store'
import type { ChatArtifact, ChatMessage } from '../../types/venice'

const STARTER_PROMPTS = [
  'Explain a difficult topic in simple language.',
  'Help me write a clear professional message.',
  'Compare two options and recommend the better one.',
]

function restoreMessage(conversationId: string, index: number, message: ChatMessage) {
  useChatStore.setState((state) => ({
    conversations: state.conversations.map((item) => {
      if (item.id !== conversationId) return item
      const at = Math.max(0, Math.min(index, item.messages.length))
      return {
        ...item,
        messages: [...item.messages.slice(0, at), message, ...item.messages.slice(at)],
      }
    }),
  }))
}

function setMessageArtifacts(conversationId: string, index: number, artifacts: ChatArtifact[]) {
  useChatStore.setState((state) => ({
    conversations: state.conversations.map((item) => {
      if (item.id !== conversationId) return item
      return {
        ...item,
        messages: item.messages.map((message, messageIndex) =>
          messageIndex === index ? { ...message, artifacts } : message,
        ),
      }
    }),
  }))
}

export function ChatView() {
  const deleteMessage = useChatStore((s) => s.deleteMessage)
  const conversations = useChatStore((s) => s.conversations)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const conversation = useChatStore((s) => {
    const id = s.activeConversationId
    return id ? s.conversations.find((c) => c.id === id) : undefined
  })
  const apiKey = useAuthStore((s) => s.apiKey)
  const chatProvider = useProviderStore((s) => s.chatProvider)
  const qwenBaseUrl = useProviderStore((s) => s.qwenBaseUrl)
  const qwenModelId = useProviderStore((s) => s.qwenModelId)
  const selectedModel = useSettingsStore((s) => s.selectedModels.chat)
  const { data: models } = useModels('text', chatProvider === 'venice')
  const veniceModel =
    selectedModel && isAllowedChatModel(selectedModel) && models?.some((m) => m.id === selectedModel)
      ? selectedModel
      : models?.find((m) => m.id === DEFAULT_CHAT_MODEL_ID)?.id || models?.[0]?.id || DEFAULT_CHAT_MODEL_ID
  const model = chatProvider === 'qwen' ? qwenModelId : veniceModel
  const providerReady = chatProvider === 'qwen'
    ? qwenBaseUrl.trim().length > 0 && qwenModelId.trim().length > 0
    : Boolean(apiKey)
  const { send, stop, regenerate, isStreaming } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  const messageCount = conversation?.messages.length ?? 0
  const lastContent = conversation?.messages[messageCount - 1]?.content
  const lastLen = typeof lastContent === 'string' ? lastContent.length : 0
  const scrollTrigger = `${messageCount}-${Math.floor(lastLen / 200)}`
  useEffect(() => {
    if (!shouldStickToBottomRef.current) return
    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollTrigger])

  const startNewChat = () => {
    if (isStreaming) stop()
    setActiveConversation(null)
    shouldStickToBottomRef.current = true
  }

  const deleteCurrentChat = () => {
    if (!conversation) return
    if (isStreaming) stop()
    const deleted = conversation
    deleteConversation(deleted.id)
    toast.error('Chat deleted', deleted.title || 'Untitled', {
      label: 'Undo',
      onClick: () => useChatStore.setState((state) => ({
        conversations: [deleted, ...state.conversations],
        activeConversationId: deleted.id,
      })),
    })
  }

  const deleteOneMessage = (index: number, message: ChatMessage) => {
    if (!conversation) return
    const conversationId = conversation.id
    deleteMessage(conversationId, index)
    toast.error('Message deleted', undefined, {
      label: 'Undo',
      onClick: () => restoreMessage(conversationId, index, message),
    })
  }

  const discardArtifact = (messageIndex: number, artifact: ChatArtifact) => {
    if (!conversation) return
    const previous = conversation.messages[messageIndex]?.artifacts || []
    const next = previous.filter((item) => item.id !== artifact.id)
    setMessageArtifacts(conversation.id, messageIndex, next)
    toast.error('Image discarded', artifact.sourceTool || 'Generated image', {
      label: 'Undo',
      onClick: () => setMessageArtifacts(conversation.id, messageIndex, previous),
    })
  }

  const sendArtifactRequest = (artifact: ChatArtifact, instruction: string) => {
    if (!providerReady) {
      toast.info('Connect the agent first', 'Configure the selected chat provider before continuing.')
      return
    }
    if (isStreaming) {
      toast.info('Agent is busy', 'Stop the current response before starting another image task.')
      return
    }
    shouldStickToBottomRef.current = true
    void send(instruction, model, [artifact.url])
  }

  return (
    <div className="flex h-full max-w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.05] bg-[#0a0a0c] px-2 py-1.5 sm:px-4">
        <button type="button" onClick={startNewChat} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New chat
        </button>
        <button type="button" onClick={() => setHistoryOpen(true)} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
          History{conversations.length ? ` (${conversations.length})` : ''}
        </button>
        {conversation && (
          <button type="button" onClick={deleteCurrentChat} className="ml-auto flex min-h-10 items-center rounded-lg px-3 text-[13px] font-medium text-rose-200/65 hover:bg-rose-500/10 hover:text-rose-200">
            Delete chat
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 max-w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
        onScroll={(event) => {
          const element = event.currentTarget
          shouldStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
        }}
      >
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <VeniceLogo size={32} className="opacity-80" />
              <div className="text-[20px] font-semibold text-white/85">How can I help today?</div>
              <p className="max-w-sm text-[14px] text-white/45">
                {providerReady
                  ? `Connected through ${chatProvider === 'qwen' ? 'Private Qwen' : 'Venice'}. Ask a question or attach an image.`
                  : chatProvider === 'qwen'
                    ? 'Configure the private Qwen OpenAI-compatible endpoint below to get started.'
                    : 'Connect a Venice API key from the header above to get started.'}
              </p>
            </div>
            {providerReady && (
              <div className="flex w-full max-w-md flex-col gap-2">
                <div className="text-left text-[12px] font-medium uppercase tracking-[0.08em] text-white/35">Try one of these</div>
                <div className="flex flex-col gap-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt, model)}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-[14px] text-white/65 transition-all hover:border-white/[0.14] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <VeniceParams />
          </div>
        ) : (
          <>
            <div className="border-b border-white/[0.04]">
              <VeniceParams />
            </div>
            <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-5 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5">
              {conversation.messages.map((message, index) => {
                const canRetry = message.role === 'assistant' && index === conversation.messages.length - 1
                return (
                  <MessageBubble
                    key={index}
                    message={message}
                    index={index}
                    onCopy={() => {}}
                    onDelete={() => deleteOneMessage(index, message)}
                    onRegenerate={canRetry ? () => regenerate(model) : undefined}
                    onArtifactEdit={(artifact) => sendArtifactRequest(
                      artifact,
                      'I want to edit this image. Ask me what I want changed before running an image tool, then use the best local workflow for my instructions.',
                    )}
                    onArtifactLocalDream={(artifact) => sendArtifactRequest(
                      artifact,
                      'Use Local Dream for the next edit of this image. Ask me what changes I want before running Local Dream, then choose img2img, inpaint, or upscale as appropriate.',
                    )}
                    onArtifactFaceFusion={(artifact) => sendArtifactRequest(
                      artifact,
                      'Use FaceFusion with this image. Ask me whether I want a face swap, face restoration, or final enhancement and what source image is needed before running the tool.',
                    )}
                    onDiscardArtifact={(artifact) => discardArtifact(index, artifact)}
                  />
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>
      <ChatInput
        onSend={(message, images) => send(message, model, images)}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!providerReady}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <ChatHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}
