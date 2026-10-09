import { useRef, useEffect, useState } from 'react'

export interface TabTransitionProps {
  activeTab: string
  children: React.ReactNode
}

interface AnimState {
  visible: boolean
  direction: 'forward' | 'back'
}

/**
 * Wraps tab content with a direction-aware fade + slide CSS transition.
 *
 * Children are expected to be conditional renders like:
 *   {activeTab === 'generate' && <div>...</div>}
 * Only one truthy child exists at a time; the others are `false`.
 * Direction is determined by the positional index of the truthy child
 * within the children array (which matches the tab order).
 */
export function TabTransition({ activeTab, children }: TabTransitionProps) {
  const [anim, setAnim] = useState<AnimState>({ visible: true, direction: 'forward' })
  // Track the positional index of the previously rendered truthy child
  const prevTruthyIndex = useRef<number>(0)

  const childArray = Array.isArray(children) ? children : [children]

  // Find the truthy child (the one conditional render that evaluated to a real element)
  let truthyChild: React.ReactNode = null
  let truthyIndex = -1
  for (let i = 0; i < childArray.length; i++) {
    const c = childArray[i]
    if (c !== false && c != null && c !== undefined) {
      truthyChild = c
      truthyIndex = i
      break
    }
  }

  useEffect(() => {
    const prevIdx = prevTruthyIndex.current

    // No direction change if this is the initial render or same position
    if (prevIdx === truthyIndex || truthyIndex === -1) return

    const direction: 'forward' | 'back' = truthyIndex > prevIdx ? 'forward' : 'back'

    // Start exit animation
    setAnim({ visible: false, direction })

    const timer = setTimeout(() => {
      // After exit completes, update tracked position and begin enter animation
      prevTruthyIndex.current = truthyIndex
      setAnim({ visible: true, direction })
    }, 200)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const translateClass = anim.visible
    ? 'translate-x-0 opacity-100'
    : anim.direction === 'forward'
      ? '-translate-x-6 opacity-0'
      : 'translate-x-6 opacity-0'

  return (
    <div
      className={translateClass}
      style={{
        transition: 'transform 200ms ease-out, opacity 200ms ease-out',
        transform: anim.visible
          ? 'translateX(0)'
          : `translateX(${anim.direction === 'forward' ? '-1.5rem' : '1.5rem'})`,
        opacity: anim.visible ? 1 : 0,
      }}
    >
      {truthyChild ?? children}
    </div>
  )
}
