import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { venice } from '../lib/venice-client'

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
      const data = await venice<BillingBalance>('/billing/balance')
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
    void refresh()
    const id = window.setInterval(() => { void refresh() }, 30_000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('venice-usage', onFocus)
    return () => {
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
