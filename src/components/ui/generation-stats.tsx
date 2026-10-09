import { useMemo } from 'react'
import { useAnalyticsStore } from '../../stores/analytics-store'

export function GenerationStats() {
  const totalGenerations = useAnalyticsStore((s) => s.totalGenerations)
  const getTopModels = useAnalyticsStore((s) => s.getTopModels)
  const getSuccessRate = useAnalyticsStore((s) => s.getSuccessRate)
  const getAverageDuration = useAnalyticsStore((s) => s.getAverageDuration)
  const entries = useAnalyticsStore((s) => s.entries)

  const formattedStats = useMemo(() => {
    const topModels = getTopModels(1)
    const topModel = topModels.length > 0 ? topModels[0].model : 'None'
    const successRate = Math.round(getSuccessRate() * 100)
    const avgDuration = Math.round(getAverageDuration() / 1000)
    const successfulGenerations = entries.filter(e => e.type === 'generation' && e.success).length

    const presetCounts = new Map<string, number>()
    for (const entry of entries) {
      if (entry.type === 'generation' && entry.contentType) {
        presetCounts.set(entry.contentType, (presetCounts.get(entry.contentType) ?? 0) + 1)
      }
    }
    let topPreset = 'None'
    let maxCount = 0
    for (const [preset, count] of presetCounts) {
      if (count > maxCount) {
        maxCount = count
        topPreset = preset
      }
    }

    return {
      total: totalGenerations,
      successful: successfulGenerations,
      avgDuration,
      successRate,
      topModel,
      topPreset,
    }
  }, [totalGenerations, getTopModels, getSuccessRate, getAverageDuration, entries])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Generations" value={formattedStats.total.toString()} />
        <StatCard label="Success Rate" value={`${formattedStats.successRate}%`} />
        <StatCard label="Avg Duration" value={`${formattedStats.avgDuration}s`} />
        <StatCard label="Successful" value={formattedStats.successful.toString()} />
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Top Model</span>
          <span className="text-white/90 font-medium truncate max-w-[60%]">{formattedStats.topModel}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Top Content Type</span>
          <span className="text-white/90 font-medium capitalize">{formattedStats.topPreset}</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="text-[11px] text-white/50 font-medium mb-1">{label}</div>
      <div className="text-[20px] font-semibold text-white">{value}</div>
    </div>
  )
}
