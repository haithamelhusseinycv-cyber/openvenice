import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  count?: number
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-lg bg-white/[0.06]',
            className,
          )}
          aria-hidden="true"
        />
      ))}
    </>
  )
}

export function ModelPickerSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-11 w-full" count={3} />
    </div>
  )
}

export function ImageGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/2] w-full" />
      ))}
    </div>
  )
}
