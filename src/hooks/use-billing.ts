import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { VeniceAPIError, veniceWithTimeout } from '../lib/venice-client'

export const VENICE_API_SETTINGS = 'https://venice.ai/settings/api'
const OPEN_KEY = 'venice-session-open-credits'

export interface BillingBalance {
  canConsume: boolean
  consumptionCurrency: string | null
  balances: {
    diem?: number | null
    usd?: number | null
  }
  diemEpochAllocation?: number | null
}

interface RateLimitBalance {
  data?: {
    accessPermitted?: boolean
    balances?: {
      USD?: number | string | null
      DIEM?: number | string | null
      usd?: number | string | null
      diem?: number | string | null
    }
  }
}

function fromRateLimits(payload: RateLimitBalance): BillingBalance {
  const raw = payload.data?.balances
  return {
    canConsume: payload.data?.accessPermitted ?? true,
    consumptionCurrency: Number(raw?.DIEM ?? raw?.diem ?? 0) > 0 ? 'DIEM' : 'USD',
    balances: {
      usd: Number(raw?.USD ?? raw?.usd ?? 0),
      diem: Number(raw?.DIEM ?? raw?.diem ?? 0),
    },
  }
}

function n(v: number | null | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function totalCredits(b: BillingBalance | null) {
  if (!b) return 0
  return n(b.balances.usd) + n(b.balances.diem)
}

function readOpen(): number | null {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY)
    if (!raw) return null
    const v = Number(raw)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function writeOpen(v: number) {
  try {
    sessionStorage.setItem(OPEN_KEY, String(v))
  } catch {
    /* ignore */
  }
}

export function useBilling() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const [balance, setBalance] = useState<BillingBalance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openTotal, setOpenTotal] = useState<number | null>(() => readOpen())

  const refresh = useCallback(async () => {
    if (!apiKey) {
      setBalance(null)
      return
    }
    try {
      let data: BillingBalance
      try {
        // Rate limits is key-scoped, works for inference-only keys, and exposes
        // the same spendable balances without requiring account-level access.
        const limits = await veniceWithTimeout<RateLimitBalance>('/api_keys/rate_limits')
        if (!limits.data?.balances) throw new Error('Balance missing from rate-limit response')
        data = fromRateLimits(limits)
      } catch (rateLimitError) {
        if (rateLimitError instanceof VeniceAPIError && rateLimitError.status === 401) throw rateLimitError
        // Give the account-level fallback its own timeout rather than sharing a
        // single deadline with the first request.
        data = await veniceWithTimeout<BillingBalance>('/billing/balance')
      }
      setBalance(data)
      setError(null)
      const now = totalCredits(data)
      const existing = readOpen()
      if (existing == null) {
        writeOpen(now)
        setOpenTotal(now)
      } else if (now > existing + 0.001) {
        writeOpen(now)
        setOpenTotal(now)
      } else {
        setOpenTotal(existing)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Balance unavailable')
    }
  }, [apiKey])

  useEffect(() => {
    const initialId = window.setTimeout(() => { void refresh() }, 0)
    const id = window.setInterval(() => { void refresh() }, 30_000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('venice-usage', onFocus)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('venice-usage', onFocus)
    }
  }, [refresh])

  const remaining = totalCredits(balance)
  const used = openTotal == null ? 0 : Math.max(0, openTotal - remaining)

  return {
    balance,
    remaining,
    used,
    currency: balance?.consumptionCurrency || 'USD',
    canConsume: balance?.canConsume ?? true,
    usd: n(balance?.balances.usd),
    diem: n(balance?.balances.diem),
    error,
    refresh,
    connected: !!apiKey,
  }
}

export function pingUsage() {
  window.dispatchEvent(new Event('venice-usage'))
}
