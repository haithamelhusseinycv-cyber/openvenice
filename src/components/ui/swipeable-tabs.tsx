import { useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '../../lib/utils'

export interface SwipeableTabsProps {
  tabs: { id: string; label: string; badge?: number }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: React.ReactNode
}

const SWIPE_THRESHOLD = 50
const SWIPE_TIME_LIMIT = 500
const SWIPE_DRAG_RATIO = 0.4

export function SwipeableTabs({ tabs, activeTab, onTabChange, children }: SwipeableTabsProps) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const tabListRef = useRef<HTMLDivElement>(null)

  const activeIndex = useMemo(
    () => Math.max(0, tabs.findIndex((t) => t.id === activeTab)),
    [tabs, activeTab],
  )

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    setDragOffset(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    // Only track horizontal drags (predominantly horizontal movement)
    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      setDragOffset(dx * SWIPE_DRAG_RATIO)
    }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y
      const dt = Date.now() - touchStart.current.time
      touchStart.current = null
      setDragOffset(0)

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      // Only register horizontal swipes that are fast enough and predominantly horizontal
      if (dt < SWIPE_TIME_LIMIT && absDx > SWIPE_THRESHOLD && absDx > absDy * 1.5) {
        if (dx < 0 && activeIndex < tabs.length - 1) {
          onTabChange(tabs[activeIndex + 1].id)
        } else if (dx > 0 && activeIndex > 0) {
          onTabChange(tabs[activeIndex - 1].id)
        }
      }
    },
    [activeIndex, tabs, onTabChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex: number | null = null
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          newIndex = activeIndex < tabs.length - 1 ? activeIndex + 1 : 0
          break
        case 'ArrowLeft':
          e.preventDefault()
          newIndex = activeIndex > 0 ? activeIndex - 1 : tabs.length - 1
          break
        case 'Home':
          e.preventDefault()
          newIndex = 0
          break
        case 'End':
          e.preventDefault()
          newIndex = tabs.length - 1
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          // Activate the currently focused tab
          const focused = document.activeElement
          if (focused instanceof HTMLElement && focused.getAttribute('role') === 'tab') {
            focused.click()
          }
          return
        }
        default:
          return
      }
      if (newIndex !== null) {
        onTabChange(tabs[newIndex].id)
        // Move focus to the newly activated tab button
        const tabList = tabListRef.current
        if (tabList) {
          const buttons = tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')
          buttons[newIndex]?.focus()
        }
      }
    },
    [activeIndex, tabs, onTabChange],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        ref={tabListRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        className="relative flex border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-xl"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              id={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-1.5 px-3 min-h-[44px] text-[13px] font-medium transition-colors duration-200',
                isActive ? 'text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-white/[0.12] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white/80">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          )
        })}
        {/* Animated sliding underline — single element that transitions between tabs */}
        <span
          className="absolute bottom-0 h-[2px] rounded-full bg-white/70 pointer-events-none"
          style={{
            left: `${(activeIndex / tabs.length) * 100}%`,
            width: `${100 / tabs.length}%`,
            transition: 'left 0.25s ease, width 0.25s ease',
          }}
        />
      </div>

      {/* Swipeable content area */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
          transition: dragOffset !== 0 ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
