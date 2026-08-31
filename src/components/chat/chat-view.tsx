import { useEffect, useRef } from 'react'
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

const STARTER_PROMPTS = [
  'Write a short explicit amateur couple sex scene I can paste into Lustify v8.',
  'Tighten this image prompt for readable vaginal penetration and visible faces.',
  'Turn this scene into a negative prompt that blocks clothes, CGI, and failed insertion.',
]

export function ChatView() {
  const deleteMessage = useChatStore((s) => s.deleteMessage)
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
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
                  ? 'Uncensored 1.2 is the default writer. Use it to draft Lustify prompts, then generate on Image.'
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
    </div>
  )
}
