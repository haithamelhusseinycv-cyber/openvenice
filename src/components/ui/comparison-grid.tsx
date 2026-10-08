import { cn } from '../../lib/utils'

interface ComparisonGridItem {
  id: string
  src: string
  label?: string
  prompt?: string
}

interface ComparisonGridProps {
  items: ComparisonGridItem[]
  columns?: 2 | 3 | 4
  onItemClick?: (item: ComparisonGridItem) => void
}

export function ComparisonGrid({ items, columns = 2, onItemClick }: ComparisonGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-white/40">
        No images to compare
      </div>
    )
  }

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }

  return (
    <div className={cn('grid gap-2', gridCols[columns])}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick?.(item)}
          className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
        >
          <img
            src={item.src}
            alt={item.label || 'Comparison'}
            className="w-full h-full object-cover"
          />
          {item.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <div className="text-[11px] font-medium text-white/90 truncate">
                {item.label}
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </button>
      ))}
    </div>
  )
}
