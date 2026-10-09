import { useState, useCallback, useRef, useEffect } from 'react';

// Session-level cache of prefetched feature IDs (LRU)
const MAX_CACHE_SIZE = 10
const prefetchCache = new Map<string, number>()
let cacheAccessCounter = 0

function touchCache(id: string) {
  prefetchCache.set(id, ++cacheAccessCounter)
}

function evictIfNeeded() {
  while (prefetchCache.size > MAX_CACHE_SIZE) {
    let oldestKey: string | null = null
    let oldestVal = Infinity
    for (const [key, val] of prefetchCache) {
      if (val < oldestVal) {
        oldestVal = val
        oldestKey = key
      }
    }
    if (oldestKey !== null) prefetchCache.delete(oldestKey)
  }
}

// Affinity scores: features that tend to be used together
const AFFINITY_MAP: Record<string, string[]> = {
  'smart-variations': ['ab-testing', 'comparison-grid', 'seed-tracker'],
  'ab-testing': ['smart-variations', 'comparison-grid', 'batch-export'],
  'prompt-scorer': ['prompt-weighting', 'prompt-templates', 'prompt-enhancer'],
  'prompt-weighting': ['prompt-scorer', 'prompt-templates', 'prompt-chains'],
  'prompt-templates': ['prompt-weighting', 'prompt-scorer', 'prompt-versioning'],
  'image-to-prompt': ['prompt-scorer', 'smart-variations', 'prompt-enhancer'],
  'seed-tracker': ['smart-variations', 'ab-testing', 'batch-export'],
  'comparison-grid': ['batch-export', 'ab-testing', 'smart-variations'],
  'batch-export': ['comparison-grid', 'batch-progress', 'auto-queue-variations'],
  'prompt-enhancer': ['prompt-scorer', 'prompt-weighting', 'prompt-chains'],
  'prompt-chains': ['prompt-enhancer', 'prompt-templates', 'prompt-versioning'],
  'prompt-versioning': ['prompt-chains', 'prompt-templates', 'prompt-weighting'],
}

const PRELOAD_DELAY_MS = 150

export function usePredictiveLoader(features: string[]) {
  const [loadedFeatures, setLoadedFeatures] = useState<Set<string>>(() => {
    // Initialize from cache
    return new Set(prefetchCache.keys())
  })

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  const getRelatedFeatures = useCallback(
    (featureId: string): string[] => {
      const related = AFFINITY_MAP[featureId] ?? []
      // Also include features from the provided list that share categories
      return related.filter((id) => features.includes(id))
    },
    [features],
  )

  const prefetchModule = useCallback((id: string) => {
    if (prefetchCache.has(id)) {
      touchCache(id)
      return
    }
    touchCache(id)
    evictIfNeeded()
  }, [])

  const preloadFeature = useCallback(
    (id: string) => {
      // Already loaded
      if (prefetchCache.has(id) || loadedFeatures.has(id)) return

      // Clear any existing timer for this feature
      const existing = timersRef.current.get(id)
      if (existing) clearTimeout(existing)

      // Schedule preload with a small delay to avoid thrashing
      const timer = setTimeout(() => {
        // Prefetch the actual module
        prefetchModule(id)
        setLoadedFeatures((prev) => new Set(prev).add(id))
        timersRef.current.delete(id)

        // Pre-load related features too
        const related = getRelatedFeatures(id)
        for (const relId of related) {
          if (!prefetchCache.has(relId) && !loadedFeatures.has(relId)) {
            prefetchModule(relId)
            setLoadedFeatures((prev) => new Set(prev).add(relId))
          }
        }
      }, PRELOAD_DELAY_MS)

      timersRef.current.set(id, timer)
    },
    [loadedFeatures, getRelatedFeatures, prefetchModule],
  )

  const cancelPreload = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  return {
    loadedFeatures,
    preloadFeature,
    cancelPreload,
  }
}

interface PredictiveWrapperProps {
  featureId: string
  onHover?: (id: string) => void
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PredictiveWrapper({ featureId, onHover, children, fallback }: PredictiveWrapperProps) {
void fallback;
  const handlePointerEnter = () => {
    onHover?.(featureId)
  }

  const handleTouchStart = () => {
    onHover?.(featureId)
  }

  return (
    <div
      onPointerEnter={handlePointerEnter}
      onTouchStart={handleTouchStart}
    >
      {children}
    </div>
  )
}
