import { useBilling, VENICE_API_SETTINGS } from '../../hooks/use-billing'

function money(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) return n.toFixed(0)
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

export function BillingBar() {
  const { connected, remaining, used, usd, diem, canConsume, error, refresh } = useBilling()

  if (!connected) return null

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {error ? (
        <button
          type="button"
          onClick={() => { void refresh() }}
          aria-label="Balance unavailable. Retry"
          className="min-h-11 rounded-md border border-amber-300/30 bg-amber-400/[0.08] px-2 text-left text-[11px] text-amber-200"
        >
          <span className="block font-medium">Balance unavailable</span>
          <span className="block text-amber-200/70">Tap to retry</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { void refresh() }}
          className={`min-h-11 flex flex-col justify-center leading-tight min-w-0 rounded-md px-2 py-1 bg-white/[0.04] ${canConsume ? 'text-white/80' : 'text-red-300'}`}
          aria-label={`${money(remaining)} credits left; ${money(used)} used. Tap to refresh.`}
        >
          <span className="text-[11px] sm:text-[13px] font-medium tabular-nums whitespace-nowrap">
            {money(remaining)} left
          </span>
          <span className="hidden sm:block text-[11px] text-white/50 tabular-nums">
            {money(used)} used
          </span>
        </button>
      )}
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
