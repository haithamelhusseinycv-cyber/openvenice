import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSettingsStore } from '../../stores/settings-store'
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

const STARTER_PROMPTS = [
  'Explain a difficult topic in simple language.',
  'Help me write a clear professional message.',
  'Compare two options and recommend the better one.',
]

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
  const selectedModel = useSettingsStore((s) => s.selectedModels.chat)
  const { data: models } = useModels('text')
  const model =
    selectedModel && isAllowedChatModel(selectedModel) && models?.some((m) => m.id === selectedModel)
      ? selectedModel
      : models?.find((m) => m.id === DEFAULT_CHAT_MODEL_ID)?.id || models?.[0]?.id || DEFAULT_CHAT_MODEL_ID
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
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
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
        onScroll={(event) => {
          const element = event.currentTarget
          shouldStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
        }}
      >
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-6">
            <div className="flex flex-col items-center gap-3">
              <VeniceLogo size={32} className="opacity-80" />
              <div className="text-[20px] font-semibold text-white/85">How can I help today?</div>
              <p className="text-[14px] text-white/45 max-w-sm">
                {apiKey
                  ? 'Ask a question, analyze an idea, draft text, or attach an image.'
                  : 'Connect a Venice API key from the header above to get started.'}
              </p>
            </div>
            {apiKey && (
              <div className="w-full max-w-md flex flex-col gap-2">
                <div className="text-[12px] uppercase tracking-[0.08em] text-white/35 font-medium text-left">Try one of these</div>
                <div className="flex flex-col gap-1.5">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p, model)}
                      className="text-left px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all text-[14px] text-white/65 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
                    >
                      {p}
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
            <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-5 px-3 py-4 sm:px-5 sm:py-5">
              {conversation.messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  index={i}
                  onCopy={() => {}}
                  onDelete={() => { if (conversation) deleteMessage(conversation.id, i) }}
                  onRegenerate={msg.role === 'assistant' && i === conversation.messages.length - 1 ? () => regenerate(model) : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>
      <ChatInput onSend={(msg, images) => send(msg, model, images)} onStop={stop} isStreaming={isStreaming} disabled={!apiKey} />
      <ChatHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}
