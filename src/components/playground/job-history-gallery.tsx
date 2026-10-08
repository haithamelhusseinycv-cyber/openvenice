import { useState, useEffect, useCallback } from 'react'
import { getSavedImages, deleteSavedImage, type SavedImage } from '../../lib/image-persistence'

interface JobHistoryGalleryProps {
  onImageSelect?: (image: SavedImage) => void
}

export function JobHistoryGallery({ onImageSelect }: JobHistoryGalleryProps) {
  const [images, setImages] = useState<SavedImage[]>([])
  const [loading, setLoading] = useState(true)

  const loadImages = useCallback(async () => {
    setLoading(true)
    try {
      const saved = await getSavedImages()
      setImages(saved)
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadImages()
    const update = () => { void loadImages() }
    window.addEventListener('chilli-images-saved', update)
    return () => window.removeEventListener('chilli-images-saved', update)
  }, [loadImages])

  const handleDelete = useCallback(async (id: string) => {
    await deleteSavedImage(id)
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  if (loading) {
    return (
      <div role="status" aria-label="Loading images" className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="text-[14px] text-white/50">No generations yet</p>
        <p className="mt-1 text-[12px] text-white/30">Your created images will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/70">
          {images.length} generation{images.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
          >
            <img
              src={image.thumbnailUri || image.uri}
              alt={image.prompt}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-active:opacity-100">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="line-clamp-2 text-[11px] text-white/80">{image.prompt}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] uppercase text-white/50">
                    {image.provider}
                  </span>
                  <span className="text-[9px] text-white/40">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(image.id)
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 opacity-0 transition-opacity group-active:opacity-100"
              aria-label={`Delete: ${image.prompt.slice(0, 40)}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            {onImageSelect && (
              <button
                type="button"
                onClick={() => onImageSelect(image)}
                className="absolute inset-0"
                aria-label={`Select: ${image.prompt.slice(0, 40)}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
