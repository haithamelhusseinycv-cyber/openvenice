import { useState } from 'react';
import { haptic } from '../../lib/haptics';

interface SeedRecord {
  promptPattern: string
  seed: number
  rating: number
  timestamp: number
}

const STORAGE_KEY = 'chilli-seed-tracker'
const MAX_RECORDS = 100

export function useSeedTracker() {
  const [records, setRecords] = useState<SeedRecord[]>(() => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : [] } catch { return [] } })



  const saveRecord = (promptPattern: string, seed: number, rating: number) => {
    const newRecord: SeedRecord = {
      promptPattern: promptPattern.slice(0, 50),
      seed,
      rating,
      timestamp: Date.now(),
    }

    setRecords((prev) => {
      const updated = [newRecord, ...prev].slice(0, MAX_RECORDS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const getBestSeed = (promptPattern: string): number | undefined => {
    const pattern = promptPattern.slice(0, 50)
    const matches = records.filter((r) => r.promptPattern === pattern)
    if (matches.length === 0) return undefined
    const best = matches.reduce((a, b) => (a.rating > b.rating ? a : b))
    return best.rating >= 4 ? best.seed : undefined
  }

  const getTopSeeds = (limit = 5): SeedRecord[] => {
    return records
      .filter((r) => r.rating >= 4)
      .sort((a, b) => b.rating - a.rating || b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  const clearRecords = () => {
    setRecords([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { records, saveRecord, getBestSeed, getTopSeeds, clearRecords }
}

interface SeedTrackerDisplayProps {
  records: SeedRecord[]
  onClear: () => void
}

export function SeedTrackerDisplay({ records, onClear }: SeedTrackerDisplayProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] text-white/40">
        No seed ratings yet. Rate generated images to track good seeds.
      </div>
    )
  }

  const topSeeds = records.filter((r) => r.rating >= 4).slice(0, 10)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/70">Top Seeds ({topSeeds.length})</span>
        <button
          type="button"
          onClick={() => {
            haptic('tap')
            onClear()
          }}
          className="text-[12px] text-white/50 hover:text-white/80 min-h-8 px-2"
        >
          Clear all
        </button>
      </div>
      {topSeeds.map((record, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] p-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="text-[12px] text-white/50 truncate max-w-[200px]">{record.promptPattern}</div>
            <div className="text-[13px] text-white/90 font-mono">{record.seed}</div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, j) => (
              <svg
                key={j}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={j < record.rating ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                className={j < record.rating ? 'text-yellow-400' : 'text-white/20'}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
