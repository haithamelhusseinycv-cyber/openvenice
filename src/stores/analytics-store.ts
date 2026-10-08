/**
 * Privacy-First Analytics Store
 * Local-only usage stats — no telemetry to third parties
 * Tracks most-used models, prompts, workflows for user insights
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AnalyticsEntry {
  timestamp: number
  type: 'generation' | 'edit' | 'upscale' | 'workflow'
  model: string
  provider: 'venice' | 'localdream' | 'atelier'
  promptLength: number
  explicitLevel?: string
  contentType?: string
  duration?: number
  success: boolean
}

interface AnalyticsState {
  entries: AnalyticsEntry[]
  totalGenerations: number
  totalEdits: number
  totalUpscales: number
  sessionStartTime: number
  optInAggregate: boolean

  trackGeneration: (data: {
    model: string
    provider: 'venice' | 'localdream' | 'atelier'
    promptLength: number
    explicitLevel?: string
    contentType?: string
    duration?: number
    success: boolean
  }) => void

  trackEdit: (data: {
    model: string
    provider: 'venice' | 'localdream' | 'atelier'
    promptLength: number
    success: boolean
  }) => void

  trackUpscale: (data: {
    model: string
    provider: 'venice' | 'localdream' | 'atelier'
    success: boolean
  }) => void

  trackWorkflow: (data: {
    model: string
    provider: 'venice' | 'localdream' | 'atelier'
    steps: number
    success: boolean
  }) => void

  getTopModels: (limit?: number) => Array<{ model: string; count: number }>
  getTopProviders: () => Array<{ provider: string; count: number }>
  getTopContentTypes: () => Array<{ type: string; count: number }>
  getSuccessRate: () => number
  getAverageDuration: () => number
  getSessionStats: () => { generations: number; edits: number; upscales: number; duration: string }

  setOptInAggregate: (optIn: boolean) => void
  clearAnalytics: () => void
}

const safeStorage = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      entries: [],
      totalGenerations: 0,
      totalEdits: 0,
      totalUpscales: 0,
      sessionStartTime: Date.now(),
      optInAggregate: false,

      trackGeneration: (data) => {
        const entry: AnalyticsEntry = {
          timestamp: Date.now(),
          type: 'generation',
          model: data.model,
          provider: data.provider,
          promptLength: data.promptLength,
          explicitLevel: data.explicitLevel,
          contentType: data.contentType,
          duration: data.duration,
          success: data.success,
        }

        set((state) => ({
          entries: [...state.entries, entry].slice(-1000),
          totalGenerations: state.totalGenerations + 1,
        }))
      },

      trackEdit: (data) => {
        const entry: AnalyticsEntry = {
          timestamp: Date.now(),
          type: 'edit',
          model: data.model,
          provider: data.provider,
          promptLength: data.promptLength,
          success: data.success,
        }

        set((state) => ({
          entries: [...state.entries, entry].slice(-1000),
          totalEdits: state.totalEdits + 1,
        }))
      },

      trackUpscale: (data) => {
        const entry: AnalyticsEntry = {
          timestamp: Date.now(),
          type: 'upscale',
          model: data.model,
          provider: data.provider,
          promptLength: 0,
          success: data.success,
        }

        set((state) => ({
          entries: [...state.entries, entry].slice(-1000),
          totalUpscales: state.totalUpscales + 1,
        }))
      },

      trackWorkflow: (data) => {
        const entry: AnalyticsEntry = {
          timestamp: Date.now(),
          type: 'workflow',
          model: data.model,
          provider: data.provider,
          promptLength: 0,
          success: data.success,
        }

        set((state) => ({
          entries: [...state.entries, entry].slice(-1000),
        }))
      },

      getTopModels: (limit = 10) => {
        const state = get()
        const counts = new Map<string, number>()

        for (const entry of state.entries) {
          counts.set(entry.model, (counts.get(entry.model) ?? 0) + 1)
        }

        return Array.from(counts.entries())
          .map(([model, count]) => ({ model, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
      },

      getTopProviders: () => {
        const state = get()
        const counts = new Map<string, number>()

        for (const entry of state.entries) {
          counts.set(entry.provider, (counts.get(entry.provider) ?? 0) + 1)
        }

        return Array.from(counts.entries())
          .map(([provider, count]) => ({ provider, count }))
          .sort((a, b) => b.count - a.count)
      },

      getTopContentTypes: () => {
        const state = get()
        const counts = new Map<string, number>()

        for (const entry of state.entries) {
          if (entry.contentType) {
            counts.set(entry.contentType, (counts.get(entry.contentType) ?? 0) + 1)
          }
        }

        return Array.from(counts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
      },

      getSuccessRate: () => {
        const state = get()
        if (state.entries.length === 0) return 1.0

        const successes = state.entries.filter((e) => e.success).length
        return successes / state.entries.length
      },

      getAverageDuration: () => {
        const state = get()
        const withDuration = state.entries.filter((e) => e.duration !== undefined)
        if (withDuration.length === 0) return 0

        const total = withDuration.reduce((sum, e) => sum + (e.duration ?? 0), 0)
        return total / withDuration.length
      },

      getSessionStats: () => {
        const state = get()
        const sessionEntries = state.entries.filter(
          (e) => e.timestamp >= state.sessionStartTime
        )

        const generations = sessionEntries.filter((e) => e.type === 'generation').length
        const edits = sessionEntries.filter((e) => e.type === 'edit').length
        const upscales = sessionEntries.filter((e) => e.type === 'upscale').length

        const durationMs = Date.now() - state.sessionStartTime
        const minutes = Math.floor(durationMs / 60000)
        const hours = Math.floor(minutes / 60)
        const duration = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`

        return { generations, edits, upscales, duration }
      },

      setOptInAggregate: (optIn) => set({ optInAggregate: optIn }),

      clearAnalytics: () => {
        set({
          entries: [],
          totalGenerations: 0,
          totalEdits: 0,
          totalUpscales: 0,
          sessionStartTime: Date.now(),
        })
      },
    }),
    {
      name: 'chilli-analytics-store',
      storage: createJSONStorage(() => safeStorage() ?? localStorage),
      partialize: (state) => ({
        entries: state.entries,
        totalGenerations: state.totalGenerations,
        totalEdits: state.totalEdits,
        totalUpscales: state.totalUpscales,
        optInAggregate: state.optInAggregate,
      }),
    }
  )
)
