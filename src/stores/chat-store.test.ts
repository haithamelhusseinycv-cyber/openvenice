import { beforeEach, describe, expect, it } from 'vitest'
import { useChatStore } from './chat-store'
import type { Conversation } from '../types/venice'

const conversations: Conversation[] = [
  { id: 'one', title: 'First', model: 'qwen-3-6-plus', createdAt: 1, messages: [] },
  { id: 'two', title: 'Second', model: 'qwen-3-6-plus', createdAt: 2, messages: [] },
]

describe('chat history actions', () => {
  beforeEach(() => {
    useChatStore.setState({ conversations, activeConversationId: 'one', isStreaming: false })
  })

  it('deletes one saved conversation and closes it when active', () => {
    useChatStore.getState().deleteConversation('one')
    expect(useChatStore.getState().conversations.map((item) => item.id)).toEqual(['two'])
    expect(useChatStore.getState().activeConversationId).toBeNull()
  })

  it('clears all saved conversations', () => {
    useChatStore.getState().clearConversations()
    expect(useChatStore.getState().conversations).toEqual([])
    expect(useChatStore.getState().activeConversationId).toBeNull()
  })
})
