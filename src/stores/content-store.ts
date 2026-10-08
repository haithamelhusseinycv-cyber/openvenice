/**
 * Content Organization Store
 * Manages tags, favorites, collections, and generation history
 * All data stored locally in localStorage for privacy
 * Thumbnails are downscaled to 200px to avoid quota issues
 */

import { saveGeneratedImage } from '../lib/image-persistence'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { classifyContent, type ContentTags } from '../lib/nsfw-content-classifier'

async function createThumbnail(dataUrl: string, maxSize: number = 200): Promise<string> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export interface ContentItem {
  id: string
  imageUrl: string
  originalId?: string
  prompt: string
  enhancedPrompt?: string
  model: string
  provider: 'venice' | 'localdream' | 'atelier'
  tags: ContentTags
  customTags: string[]
  favorite: boolean
  collectionId?: string
  createdAt: number
  updatedAt: number
  metadata?: {
    negativePrompt?: string
    aspectRatio?: string
    preset?: string
    steps?: number
    cfg?: number
    resolution?: string
    seed?: number
  }
}

export interface Collection {
  id: string
  name: string
  description?: string
  color: string
  itemIds: string[]
  createdAt: number
  updatedAt: number
}

interface ContentState {
  items: ContentItem[]
  collections: Collection[]
  searchQuery: string
  filterTags: Partial<ContentTags>
  showFavoritesOnly: boolean
  blurThumbnails: boolean

  addItem: (item: Omit<ContentItem, 'id' | 'tags' | 'customTags' | 'favorite' | 'createdAt' | 'updatedAt'>) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<ContentItem>) => void
  toggleFavorite: (id: string) => void
  addCustomTag: (itemId: string, tag: string) => void
  removeCustomTag: (itemId: string, tag: string) => void
  moveToCollection: (itemId: string, collectionId: string | undefined) => void

  createCollection: (name: string, color: string, description?: string) => void
  updateCollection: (id: string, updates: Partial<Collection>) => void
  deleteCollection: (id: string) => void

  setSearchQuery: (query: string) => void
  setFilterTags: (tags: Partial<ContentTags>) => void
  toggleFavoritesOnly: () => void
  setBlurThumbnails: (blur: boolean) => void

  getFilteredItems: () => ContentItem[]
  searchItems: (query: string) => ContentItem[]
  getItemsByCollection: (collectionId: string) => ContentItem[]
  getSimilarItems: (itemId: string, limit?: number) => ContentItem[]

  clearAll: () => void
}

const safeStorage = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      items: [],
      collections: [],
      searchQuery: '',
      filterTags: {},
      showFavoritesOnly: false,
      blurThumbnails: true,

      addItem: (itemData) => {
        const tags = classifyContent(itemData.prompt)
        const originalId = itemData.originalId || crypto.randomUUID()
        const thumbnailPromise = (typeof indexedDB === 'undefined' ? Promise.resolve() : saveGeneratedImage({ id: originalId, imageUrl: itemData.imageUrl, prompt: itemData.prompt, provider: itemData.provider })).then(() => createThumbnail(itemData.imageUrl))

        thumbnailPromise.then((thumbnailUrl) => {
          const newItem: ContentItem = {
            ...itemData,
            originalId,
            id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            imageUrl: thumbnailUrl,
            tags,
            customTags: [],
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          set((state) => ({
            items: [newItem, ...state.items].slice(0, 200),
          }))
        }).catch(() => {
          const newItem: ContentItem = {
            ...itemData,
            originalId,
            id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            tags,
            customTags: [],
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          set((state) => ({
            items: [newItem, ...state.items].slice(0, 200),
          }))
        })
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          collections: state.collections.map((c) => ({
            ...c,
            itemIds: c.itemIds.filter((itemId) => itemId !== id),
          })),
        }))
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
          ),
        }))
      },

      toggleFavorite: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, favorite: !item.favorite, updatedAt: Date.now() } : item
          ),
        }))
      },

      addCustomTag: (itemId, tag) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId && !item.customTags.includes(tag)
              ? { ...item, customTags: [...item.customTags, tag], updatedAt: Date.now() }
              : item
          ),
        }))
      },

      removeCustomTag: (itemId, tag) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? { ...item, customTags: item.customTags.filter((t) => t !== tag), updatedAt: Date.now() }
              : item
          ),
        }))
      },

      moveToCollection: (itemId, collectionId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, collectionId, updatedAt: Date.now() } : item
          ),
          collections: state.collections.map((c) => {
            if (c.id === collectionId && !c.itemIds.includes(itemId)) {
              return { ...c, itemIds: [...c.itemIds, itemId], updatedAt: Date.now() }
            }
            if (c.itemIds.includes(itemId) && c.id !== collectionId) {
              return { ...c, itemIds: c.itemIds.filter((id) => id !== itemId), updatedAt: Date.now() }
            }
            return c
          }),
        }))
      },

      createCollection: (name, color, description) => {
        const newCollection: Collection = {
          id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name,
          description,
          color,
          itemIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        set((state) => ({
          collections: [...state.collections, newCollection],
        }))
      },

      updateCollection: (id, updates) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          ),
        }))
      },

      deleteCollection: (id) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
          items: state.items.map((item) =>
            item.collectionId === id ? { ...item, collectionId: undefined } : item
          ),
        }))
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilterTags: (tags) => set({ filterTags: tags }),
      toggleFavoritesOnly: () => set((state) => ({ showFavoritesOnly: !state.showFavoritesOnly })),
      setBlurThumbnails: (blur) => set({ blurThumbnails: blur }),

      getFilteredItems: () => {
        const state = get()
        let items = state.items

        if (state.showFavoritesOnly) {
          items = items.filter((item) => item.favorite)
        }

        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase()
          items = items.filter(
            (item) =>
              item.prompt.toLowerCase().includes(query) ||
              item.customTags.some((tag) => tag.toLowerCase().includes(query)) ||
              item.tags.contentType.includes(query) ||
              item.tags.explicitLevel.includes(query)
          )
        }

        const filterTags = state.filterTags
        if (filterTags.contentType) {
          items = items.filter((item) => item.tags.contentType === filterTags.contentType)
        }
        if (filterTags.explicitLevel) {
          items = items.filter((item) => item.tags.explicitLevel === filterTags.explicitLevel)
        }
        if (filterTags.sceneType) {
          items = items.filter((item) => item.tags.sceneType === filterTags.sceneType)
        }

        return items
      },

      searchItems: (query) => {
        const state = get()
        const lowerQuery = query.toLowerCase()
        return state.items.filter(
          (item) =>
            item.prompt.toLowerCase().includes(lowerQuery) ||
            item.customTags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
            item.tags.positions.some((p) => p.includes(lowerQuery)) ||
            item.tags.kinks.some((k) => k.includes(lowerQuery))
        )
      },

      getItemsByCollection: (collectionId) => {
        const state = get()
        return state.items.filter((item) => item.collectionId === collectionId)
      },

      getSimilarItems: (itemId, limit = 6) => {
        const state = get()
        const target = state.items.find((item) => item.id === itemId)
        if (!target) return []

        return state.items
          .filter((item) => item.id !== itemId)
          .map((item) => ({
            item,
            score: calculateSimilarity(target, item),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(({ item }) => item)
      },

      clearAll: () => {
        set({
          items: [],
          collections: [],
          searchQuery: '',
          filterTags: {},
          showFavoritesOnly: false,
        })
      },
    }),
    {
      name: 'chilli-content-store',
      version: 2,
      storage: createJSONStorage(() => safeStorage() ?? localStorage),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as ContentState
        const s = persisted as Partial<ContentState>
        if (Array.isArray(s.items)) {
          s.items = s.items
            .filter((item) => item && typeof item.id === 'string' && item.id.length > 0)
            .map((item) => ({
              ...item,
              customTags: Array.isArray(item.customTags) ? item.customTags : [],
              favorite: typeof item.favorite === 'boolean' ? item.favorite : false,
            }))
        }
        if (Array.isArray(s.collections)) {
          s.collections = s.collections
            .filter((col) => col && typeof col.id === 'string')
            .map((col) => ({
              ...col,
              itemIds: Array.isArray(col.itemIds) ? col.itemIds : [],
            }))
        }
        return s as ContentState
      },
      partialize: (state) => ({
        items: state.items,
        collections: state.collections,
        blurThumbnails: state.blurThumbnails,
      }),
    }
  )
)

function calculateSimilarity(a: ContentItem, b: ContentItem): number {
  let score = 0

  if (a.tags.contentType === b.tags.contentType) score += 0.3
  if (a.tags.explicitLevel === b.tags.explicitLevel) score += 0.2
  if (a.tags.sceneType === b.tags.sceneType) score += 0.2
  if (a.model === b.model) score += 0.1

  const commonPositions = a.tags.positions.filter((p) => b.tags.positions.includes(p))
  score += commonPositions.length * 0.05

  const commonKinks = a.tags.kinks.filter((k) => b.tags.kinks.includes(k))
  score += commonKinks.length * 0.03

  const commonTags = a.customTags.filter((t) => b.customTags.includes(t))
  score += commonTags.length * 0.02

  return Math.min(score, 1.0)
}
