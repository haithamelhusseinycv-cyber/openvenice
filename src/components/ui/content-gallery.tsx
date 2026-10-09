import { getSavedImages } from '../../lib/image-persistence';
import { toast } from '../../stores/toast-store';
import { useState } from 'react';
import { useContentStore, type ContentItem } from '../../stores/content-store';
import { haptic } from '../../lib/haptics';
import type { ContentType, ExplicitLevel } from '../../lib/nsfw-content-classifier';

interface Props {
  onSelect?: (item: ContentItem) => void
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  solo: 'Solo',
  couple: 'Couple',
  threesome: 'Threesome',
  group: 'Group',
  orgy: 'Orgy',
}

const EXPLICIT_LABELS: Record<ExplicitLevel, string> = {
  softcore: 'Soft',
  artistic: 'Art',
  explicit: 'Explicit',
  pornographic: 'XXX',
}

const EXPLICIT_COLORS: Record<ExplicitLevel, string> = {
  softcore: 'bg-amber-500/20 text-amber-300',
  artistic: 'bg-blue-500/20 text-blue-300',
  explicit: 'bg-purple-500/20 text-purple-300',
  pornographic: 'bg-rose-500/20 text-rose-300',
}

export function ContentGallery({ onSelect }: Props) {
  const items = useContentStore((s) => s.getFilteredItems())
  const searchQuery = useContentStore((s) => s.searchQuery)
  const setSearchQuery = useContentStore((s) => s.setSearchQuery)
  const showFavoritesOnly = useContentStore((s) => s.showFavoritesOnly)
  const toggleFavoritesOnly = useContentStore((s) => s.toggleFavoritesOnly)
  const blurThumbnails = useContentStore((s) => s.blurThumbnails)
  const setBlurThumbnails = useContentStore((s) => s.setBlurThumbnails)
  const toggleFavorite = useContentStore((s) => s.toggleFavorite)
  const removeItem = useContentStore((s) => s.removeItem)
  const setFilterTags = useContentStore((s) => s.setFilterTags)
  const filterTags = useContentStore((s) => s.filterTags)

  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | ''>('')
  const [explicitFilter, setExplicitFilter] = useState<ExplicitLevel | ''>('')
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const handleContentTypeFilter = (type: ContentType | '') => {
    haptic('tap')
    setContentTypeFilter(type)
    setFilterTags({ ...filterTags, contentType: type || undefined })
  }

  const handleExplicitFilter = (level: ExplicitLevel | '') => {
    haptic('tap')
    setExplicitFilter(level)
    setFilterTags({ ...filterTags, explicitLevel: level || undefined })
  }

  const revealImage = (id: string) => {
    setRevealedIds((prev) => new Set(prev).add(id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts, tags..."
            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.04] py-2 pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/[0.25]"
          />
        </div>
        <button
          onClick={() => { haptic('tap'); toggleFavoritesOnly() }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            showFavoritesOnly
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-white/[0.09] bg-white/[0.04] text-white/40 hover:text-white/60'
          }`}
          aria-label="Show favorites only"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
        <button
          onClick={() => { haptic('tap'); setBlurThumbnails(!blurThumbnails) }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            blurThumbnails
              ? 'border-white/[0.2] bg-white/[0.08] text-white/60'
              : 'border-white/[0.09] bg-white/[0.04] text-white/40 hover:text-white/60'
          }`}
          aria-label="Toggle blur"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        <button
          onClick={() => handleContentTypeFilter('')}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            !contentTypeFilter ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-white/50'
          }`}
        >
          All types
        </button>
        {(Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleContentTypeFilter(key)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              contentTypeFilter === key ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-white/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        <button
          onClick={() => handleExplicitFilter('')}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            !explicitFilter ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-white/50'
          }`}
        >
          All levels
        </button>
        {(Object.entries(EXPLICIT_LABELS) as [ExplicitLevel, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleExplicitFilter(key)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              explicitFilter === key ? 'bg-white/[0.12] text-white' : 'bg-white/[0.04] text-white/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="mb-3 text-white/20" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="text-[14px] text-white/40">No generations yet</p>
          <p className="mt-1 text-[12px] text-white/25">Your creations will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 px-1">
          {items.map((item) => {
            const isRevealed = revealedIds.has(item.id) || !blurThumbnails
            const explicitColor = EXPLICIT_COLORS[item.tags.explicitLevel]

            return (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.04]"
              >
                <button
                  onClick={() => {
                    if (!isRevealed && blurThumbnails) {
                      revealImage(item.id)
                    } else {
                      void (async () => {
                        if (!item.originalId) { onSelect?.(item); return }
                        const original = (await getSavedImages()).find(image => image.id === item.originalId)
                        if (!original) throw new Error('Original image is no longer stored on this device')
                        onSelect?.({ ...item, imageUrl: original.uri })
                      })().catch(error => toast.fromError(error, 'Could not open original image'))
                    }
                  }}
                  className="h-full w-full"
                >
                  <img
                    src={item.imageUrl}
                    alt=""
                    className={`h-full w-full object-cover transition-all duration-300 ${
                      isRevealed ? 'blur-0' : 'blur-xl scale-110'
                    }`}
                  />
                </button>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${explicitColor}`}>
                      {EXPLICIT_LABELS[item.tags.explicitLevel]}
                    </span>
                    <span className="text-[9px] text-white/50 truncate">
                      {CONTENT_TYPE_LABELS[item.tags.contentType]}
                    </span>
                  </div>
                </div>

                <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); haptic('tap'); toggleFavorite(item.id) }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={item.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); haptic('tap'); removeItem(item.id) }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-red-400"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
