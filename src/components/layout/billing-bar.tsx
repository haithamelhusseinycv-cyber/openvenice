import { useBilling, VENICE_API_SETTINGS } from '../../hooks/use-billing'

function money(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) return n.toFixed(0)
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

export function BillingBar() {
  const { connected, remaining, used, usd, diem, canConsume, error } = useBilling()

  if (!connected) return null

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <div
        className={`flex flex-col leading-tight min-w-0 rounded-md px-2 py-1 bg-white/[0.04] ${canConsume ? 'text-white/80' : 'text-red-300'}`}
        title={error || `USD ${money(usd)} · DIEM ${money(diem)}`}
      >
        <span className="text-[11px] sm:text-[13px] font-medium tabular-nums whitespace-nowrap">
          {money(remaining)} left
        </span>
        <span className="hidden sm:block text-[11px] text-white/50 tabular-nums">
          {money(used)} used
        </span>
      </div>
      <a
        href={VENICE_API_SETTINGS}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-11 px-2.5 rounded-md border border-white/[0.14] text-[13px] font-medium text-white hover:border-white/40 hover:bg-white/[0.04] flex items-center"
      >
        Top up
      </a>
    </div>
  )
}
