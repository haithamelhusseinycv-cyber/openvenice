import { useState, useCallback } from 'react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

const FAVORITES_KEY = 'chilli-image-favorites'

interface FavoriteImage {
  id: string
  src: string
  prompt?: string
  model?: string
  timestamp: number
}

export function useImageFavorites() {
  const [favorites, setFavorites] = useState<FavoriteImage[]>(() => { try { const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); return Array.isArray(value) ? value : [] } catch { return [] } })



  const persist = useCallback((updated: FavoriteImage[]) => {
    setFavorites(updated)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const addFavorite = useCallback((image: { id: string; src: string; prompt?: string; model?: string }) => {
    haptic('success')
    setFavorites((prev) => {
      if (prev.some((f) => f.id === image.id)) return prev
      const updated = [{ ...image, timestamp: Date.now() }, ...prev]
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated))
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const removeFavorite = useCallback((id: string) => {
    haptic('tap')
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.id !== id)
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated))
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const toggleFavorite = useCallback((image: { id: string; src: string; prompt?: string; model?: string }) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === image.id)
      if (exists) {
        const updated = prev.filter((f) => f.id !== image.id)
        haptic('tap')
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      } else {
        const updated = [{ ...image, timestamp: Date.now() }, ...prev]
        haptic('success')
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      }
    })
  }, [])

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  )

  const clearAll = useCallback(() => {
    persist([])
  }, [persist])

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, clearAll }
}

interface FavoriteButtonProps {
  imageId: string
  imageData: { src: string; prompt?: string; model?: string }
  isFavorite: boolean
  onToggle: (image: { id: string; src: string; prompt?: string; model?: string }) => void
  size?: 'sm' | 'md' | 'lg'
}

export function FavoriteButton({ imageId, imageData, isFavorite: starred, onToggle, size = 'md' }: FavoriteButtonProps) {
  const [animating, setAnimating] = useState(false)

  const handleClick = () => {
    setAnimating(true)
    onToggle({ id: imageId, ...imageData })
    setTimeout(() => setAnimating(false), 300)
  }

  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  }

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 18,
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-200',
        sizeClasses[size],
        starred
          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
          : 'bg-white/[0.06] text-white/30 hover:text-amber-300/70 hover:bg-white/[0.1]',
        animating && 'scale-125',
      )}
    >
      <svg
        width={iconSize[size]}
        height={iconSize[size]}
        viewBox="0 0 24 24"
        fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}

interface FavoritesGalleryProps {
  favorites: FavoriteImage[]
  onRemove: (id: string) => void
  onSelect?: (favorite: FavoriteImage) => void
}

export function FavoritesGallery({ favorites, onRemove, onSelect }: FavoritesGalleryProps) {
  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15 mb-2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <p className="text-[13px] text-white/30">No favorites yet</p>
        <p className="text-[11px] text-white/20 mt-1">Star images to save them here</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="relative group rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03]"
        >
          <button
            type="button"
            onClick={() => onSelect?.(fav)}
            className="w-full aspect-square"
          >
            <img
              src={fav.src}
              alt={fav.prompt || 'Favorite image'}
              className="w-full h-full object-cover"
            />
          </button>
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => { haptic('tap'); onRemove(fav.id) }}
              className="h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-amber-300 hover:text-red-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          </div>
          {fav.prompt && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
              <p className="text-[10px] text-white/60 truncate">{fav.prompt}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
