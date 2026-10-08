import { useState, useRef, useEffect } from 'react';


interface ComparisonSliderProps {
  beforeSrc: string
  afterSrc: string
  beforeLabel?: string
  afterLabel?: string
}

export function ComparisonSlider({ beforeSrc, afterSrc, beforeLabel = 'Before', afterLabel = 'After' }: ComparisonSliderProps) {
  const [position, setPosition] = useState(50)
  const [containerWidth, setContainerWidth] = useState<number | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handleMove = (clientX: number) => {
    if (!containerRef.current || !dragging.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPosition(percent)
  }

  const handlePointerDown = () => {
    dragging.current = true
  }

  const handlePointerUp = () => {
    dragging.current = false
  }

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden select-none touch-none"
      onPointerMove={(e) => handleMove(e.clientX)}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ width: containerWidth || '100%' }}
          draggable={false}
        />
      </div>

      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onPointerDown={handlePointerDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-xl flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
            <path d="M8 12H16M8 12L10 10M8 12L10 14M16 12L14 10M16 12L14 14" />
          </svg>
        </div>
      </div>

      <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
        {afterLabel}
      </div>
    </div>
  )
}
