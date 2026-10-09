import { useState, useCallback } from 'react';

export interface FeatureUsage {
  featureId: string
  count: number
  lastUsed: number
  contexts: string[]
}

const STORAGE_KEY = 'chilli-feature-usage'
const FAVORITES_KEY = 'chilli-feature-favorites'
const MAX_TRACKED = 50

function loadUsage(): FeatureUsage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveUsage(usage: FeatureUsage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
  } catch (e) {
    console.warn('Failed to save feature usage to localStorage:', e)
  }
}

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveFavorites(favorites: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch (e) {
    console.warn('Failed to save favorites to localStorage:', e)
  }
}

function pruneOldFeatures(usage: FeatureUsage[]): FeatureUsage[] {
  if (usage.length <= MAX_TRACKED) return usage
  return [...usage]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_TRACKED)
}

export function useFeatureTracker() {
  const [usage, setUsage] = useState<FeatureUsage[]>(loadUsage)
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)



  const trackFeature = useCallback((featureId: string, context?: string) => {
    setUsage((prev) => {
      const existing = prev.find((u) => u.featureId === featureId)
      let updated: FeatureUsage[]

      if (existing) {
        updated = prev.map((u) =>
          u.featureId === featureId
            ? {
                ...u,
                count: u.count + 1,
                lastUsed: Date.now(),
                contexts: context && !u.contexts.includes(context)
                  ? [...u.contexts, context].slice(-5)
                  : u.contexts,
              }
            : u
        )
      } else {
        const newEntry: FeatureUsage = {
          featureId,
          count: 1,
          lastUsed: Date.now(),
          contexts: context ? [context] : [],
        }
        updated = [...prev, newEntry]
      }

      updated = pruneOldFeatures(updated)
      saveUsage(updated)
      return updated
    })
  }, [])

  const getRecentFeatures = useCallback((): FeatureUsage[] => {
    return [...usage]
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 5)
  }, [usage])

  const getFavoriteFeatures = useCallback((): FeatureUsage[] => {
    return usage.filter((u) => favorites.includes(u.featureId))
  }, [usage, favorites])

  const getUsageHeatmap = useCallback((): Record<string, number> => {
    const heatmap: Record<string, number> = {}
    for (const u of usage) {
      heatmap[u.featureId] = u.count
    }
    return heatmap
  }, [usage])

  const getUsageCounts = useCallback((): Record<string, number> => {
    const counts: Record<string, number> = {}
    for (const u of usage) {
      counts[u.featureId] = u.count
    }
    return counts
  }, [usage])

  const resetTracking = useCallback(() => {
    setUsage([])
    setFavorites([])
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(FAVORITES_KEY)
    } catch (e) {
      console.warn('Failed to clear tracking data from localStorage:', e)
    }
  }, [])

  const toggleFavorite = useCallback((featureId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId]
      saveFavorites(updated)
      return updated
    })
  }, [])

  return {
    trackFeature,
    getRecentFeatures,
    getFavoriteFeatures,
    getUsageHeatmap,
    getUsageCounts,
    resetTracking,
    toggleFavorite,
    usage,
    favorites,
  }
}
