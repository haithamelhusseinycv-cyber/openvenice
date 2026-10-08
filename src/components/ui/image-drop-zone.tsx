import { useState, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

interface ImageDropZoneProps {
  onImageDrop: (dataUrl: string) => void
  accept?: string
  className?: string
}

export function ImageDropZone({ onImageDrop, accept = 'image/jpeg,image/png,image/webp', className }: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        haptic('success')
        onImageDrop(result)
      }
    }
    reader.readAsDataURL(file)
  }, [onImageDrop])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFile])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer min-h-[100px]',
        dragging
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'border-white/[0.12] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]',
        className
      )}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span className="text-[13px] text-white/50">Drop image or tap to browse</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  )
}
