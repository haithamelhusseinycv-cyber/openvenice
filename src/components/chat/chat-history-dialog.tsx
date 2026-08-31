import { useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { toast } from '../../stores/toast-store'
import type { Conversation } from '../../types/venice'

interface ChatHistoryDialogProps {
  open: boolean
  onClose: () => void
}

export function ChatHistoryDialog({ open, onClose }: ChatHistoryDialogProps) {
  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const clearConversations = useChatStore((s) => s.clearConversations)
  const [confirmClear, setConfirmClear] = useState(false)

  if (!open) return null

  const deleteOne = (conversation: Conversation) => {
    const wasActive = conversation.id === activeConversationId
    deleteConversation(conversation.id)
    toast.error('Chat deleted', conversation.title || 'Untitled', {
      label: 'Undo',
      onClick: () => useChatStore.setState((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: wasActive ? conversation.id : state.activeConversationId,
      })),
    })
  }

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      window.setTimeout(() => setConfirmClear(false), 3000)
      return
    }

    const snapshot = conversations
    const previousActive = activeConversationId
    clearConversations()
    setConfirmClear(false)
    onClose()
    toast.error('All chats deleted', `${snapshot.length} conversation${snapshot.length === 1 ? '' : 's'} removed`, {
      label: 'Undo',
      onClick: () => useChatStore.setState({ conversations: snapshot, activeConversationId: previousActive }),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Chat history">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close chat history" onClick={onClose} />
      <section className="relative flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/[0.1] bg-[#111116] shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-white">Chat history</h2>
            <p className="text-[12px] text-white/40">Saved on this device</p>
          </div>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className={`min-h-10 rounded-lg px-3 text-[13px] font-medium transition-colors ${confirmClear ? 'bg-rose-500/20 text-rose-200' : 'text-white/50 hover:bg-white/[0.05] hover:text-rose-200'}`}
            >
              {confirmClear ? 'Tap again to clear' : 'Clear all'}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => { setActiveConversation(null); onClose() }}
          className="m-3 mb-1 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-semibold text-black hover:bg-white/90"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New chat
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-12 text-center text-[14px] text-white/35">No saved chats yet.</div>
          ) : (
            <div className="flex flex-col gap-1" role="list">
              {conversations.map((conversation) => (
                <div key={conversation.id} role="listitem" className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${conversation.id === activeConversationId ? 'border-white/[0.14] bg-white/[0.07]' : 'border-transparent bg-white/[0.025]'}`}>
                  <button
                    type="button"
                    onClick={() => { setActiveConversation(conversation.id); onClose() }}
                    className="min-w-0 flex-1 py-1 text-left"
                  >
                    <div className="truncate text-[14px] font-medium text-white/85">{conversation.title || 'Untitled'}</div>
                    <div className="mt-0.5 text-[11px] text-white/35">{new Date(conversation.createdAt).toLocaleString()}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOne(conversation)}
                    aria-label={`Delete ${conversation.title || 'chat'}`}
                    className="flex min-h-10 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium text-rose-200/70 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
