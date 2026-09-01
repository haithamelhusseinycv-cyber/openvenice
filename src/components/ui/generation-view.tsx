import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface Props {
  controls: ReactNode
  output: ReactNode
  history?: ReactNode
  className?: string
}

export function GenerationView({ controls, output, history, className }: Props) {
  return (
    <div className={cn('flex h-full max-w-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y bg-[#0a0a0c] lg:flex-row lg:overflow-hidden', className)}>
      <aside className="w-full max-w-full min-w-0 shrink-0 border-b border-white/[0.05] bg-[#0c0c10] lg:flex lg:w-[400px] lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex max-w-full min-w-0 flex-col gap-3 p-3 sm:gap-4 sm:p-5 lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:touch-pan-y">
          {controls}
        </div>
        {history && (
          <div className="max-w-full min-w-0 border-t border-white/[0.05] p-3 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:touch-pan-y">
            {history}
          </div>
        )}
      </aside>
      <main className="max-w-full min-w-0 flex-1 overflow-x-hidden p-3 sm:p-5 lg:overflow-y-auto lg:overscroll-contain lg:touch-pan-y lg:p-7">
        {output}
      </main>
    </div>
  )
}
