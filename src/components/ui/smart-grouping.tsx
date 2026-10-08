import { useState, useMemo, useEffect } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

export interface SmartGroupingProps {
  features: { id: string; label: string; category: string; usageCount: number }[]
  onFeatureClick: (featureId: string) => void
}

interface Group {
  id: string
  label: string
  items: SmartGroupingProps['features']
}

const COLLAPSED_KEY = 'chilli-smart-grouping-collapsed'

function loadCollapsedState(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function saveCollapsedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save collapsed state:', e)
  }
}

function buildGroups(features: SmartGroupingProps['features']): Group[] {
  const sorted = [...features].sort((a, b) => b.usageCount - a.usageCount)

  const frequentlyUsed = sorted.filter((f) => f.usageCount >= 3)
  const occasionallyUsed = sorted.filter((f) => f.usageCount < 3 && f.usageCount > 0)
  const unused = sorted.filter((f) => f.usageCount === 0)

  const groups: Group[] = []

  if (frequentlyUsed.length > 0) {
    groups.push({ id: 'frequent', label: 'Frequently Used', items: frequentlyUsed })
  }
  if (occasionallyUsed.length > 0) {
    groups.push({ id: 'occasional', label: 'Occasionally Used', items: occasionallyUsed })
  }
  if (unused.length > 0) {
    groups.push({ id: 'all', label: 'All Features', items: unused })
  }

  // If no groups were created (all features have 0 usage), show everything under "All Features"
  if (groups.length === 0 && features.length > 0) {
    groups.push({ id: 'all', label: 'All Features', items: sorted })
  }

  return groups
}

export function SmartGrouping({ features, onFeatureClick }: SmartGroupingProps) {
  const groups = useMemo(() => buildGroups(features), [features])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsedState())

  // Persist collapsed state whenever it changes
  useEffect(() => {
    saveCollapsedState(collapsed)
  }, [collapsed])

  const toggleGroup = (groupId: string) => {
    haptic('tap')
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  if (features.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] text-white/40">
        No features available
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false

        return (
          <div key={group.id} role="group" aria-label={group.label}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex items-center justify-between px-1 py-1.5 min-h-8"
              aria-expanded={!isCollapsed}
            >
              <span className="text-[11px] text-white/30 uppercase tracking-wider font-medium">
                {group.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/20">{group.items.length}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    'text-white/30 transition-transform duration-200',
                    isCollapsed ? '-rotate-90' : 'rotate-0',
                  )}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-1">
                {group.items.map((feature) => (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => {
                      haptic('tap')
                      onFeatureClick(feature.id)
                    }}
                    className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.98] min-h-11"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[13px] font-medium text-white/80">{feature.label}</span>
                      <span className="text-[11px] text-white/35">{feature.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {feature.usageCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white/[0.06] px-1.5 text-[10px] font-medium text-white/40">
                          {feature.usageCount}
                        </span>
                      )}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white/20"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
