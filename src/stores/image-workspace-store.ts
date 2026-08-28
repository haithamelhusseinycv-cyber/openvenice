import { create } from 'zustand'

export type ImageSubTab = 'generate' | 'tools'
export type ImageToolId = 'edit' | 'swap' | 'undress' | 'upscale' | 'remove-bg'

interface PendingSource {
  data: string
  name: string
  tool: ImageToolId
}

interface ImageWorkspaceState {
  imageSubTab: ImageSubTab
  setImageSubTab: (tab: ImageSubTab) => void
  pendingSource: PendingSource | null
  sendToTool: (tool: ImageToolId, data: string, name?: string) => void
  sendToEdit: (data: string, name?: string) => void
  consumePendingSource: () => PendingSource | null
}

export const useImageWorkspace = create<ImageWorkspaceState>((set, get) => ({
  imageSubTab: 'generate',
  setImageSubTab: (tab) => set({ imageSubTab: tab }),
  pendingSource: null,
  sendToTool: (tool, data, name = 'generated.png') =>
    set({
      imageSubTab: 'tools',
      pendingSource: { data, name, tool },
    }),
  sendToEdit: (data, name = 'generated.png') =>
    get().sendToTool('edit', data, name),
  consumePendingSource: () => {
    const pending = get().pendingSource
    if (pending) set({ pendingSource: null })
    return pending
  },
}))
