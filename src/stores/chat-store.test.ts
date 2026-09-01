import { beforeEach, describe, expect, it } from 'vitest'
import { conversationsForStorage, useChatStore } from './chat-store'
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

  it('omits base64 image attachments from persisted chat history', () => {
    const stored = conversationsForStorage([{
      ...conversations[0],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,very-large-payload' } },
        ],
      }],
    }])

    expect(stored[0].messages[0].content).toBe('Describe this image')
    expect(JSON.stringify(stored)).not.toContain('very-large-payload')
  })

  it('records the model actually reported by the streamed response', () => {
    useChatStore.setState({
      conversations: [{
        ...conversations[0],
        messages: [{ role: 'assistant', content: '', requested_model: 'requested-model' }],
      }],
      activeConversationId: 'one',
    })

    useChatStore.getState().setLastAssistantServedModel('one', 'served-model')

    expect(useChatStore.getState().conversations[0].messages[0]).toMatchObject({
      requested_model: 'requested-model',
      served_model: 'served-model',
    })
  })
})
