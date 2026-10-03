import { create } from 'zustand'

export type ImageSubTab = 'generate' | 'tools'
export type ImageToolId = 'edit' | 'swap' | 'undress' | 'upscale' | 'remove-bg'

interface PendingSource {
  data: string
  name: string
  tool: ImageToolId
}

interface ImageWorkspaceState {
  generatedImages: string[]
  addGeneratedImages: (images: string[]) => void
  imageSubTab: ImageSubTab
  setImageSubTab: (tab: ImageSubTab) => void
  pendingSource: PendingSource | null
  sendToTool: (tool: ImageToolId, data: string, name?: string) => void
  sendToEdit: (data: string, name?: string) => void
  clearPendingSource: () => void
  consumePendingSource: () => PendingSource | null
}

export const useImageWorkspace = create<ImageWorkspaceState>((set, get) => ({
  // Keep a small gallery in memory across Generate/Tools navigation.
  generatedImages: [],
  addGeneratedImages: (images) => set((state) => ({
    generatedImages: [...images, ...state.generatedImages].slice(0, 2),
  })),
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
  clearPendingSource: () => set({ pendingSource: null }),
  consumePendingSource: () => {
    const pending = get().pendingSource
    if (pending) set({ pendingSource: null })
    return pending
  },
}))
