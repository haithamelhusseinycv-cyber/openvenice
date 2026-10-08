import { useRef, useCallback } from 'react';
import { haptic } from '../../lib/haptics';

interface GestureControlsProps {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onPinchIn?: () => void
  onPinchOut?: () => void
  onDoubleTap?: () => void
  enabled?: boolean
}

export function useGestureControls({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinchIn,
  onPinchOut,
  onDoubleTap,
  enabled = true,
}: GestureControlsProps) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastTap = useRef(0)
  const initialDistance = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      initialDistance.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [enabled])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStart.current) return

    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.time
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Double tap detection
    const now = Date.now()
    if (now - lastTap.current < 300 && absDx < 10 && absDy < 10) {
      haptic('select')
      onDoubleTap?.()
      lastTap.current = 0
      touchStart.current = null
      return
    }
    lastTap.current = now

    // Swipe detection (min 50px, fast enough)
    if (dt < 500 && (absDx > 50 || absDy > 50)) {
      haptic('tap')
      if (absDx > absDy) {
        if (dx > 0) onSwipeRight?.()
        else onSwipeLeft?.()
      } else {
        if (dy > 0) onSwipeDown?.()
        else onSwipeUp?.()
      }
    }

    touchStart.current = null
    initialDistance.current = null
  }, [enabled, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTap])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 2 || initialDistance.current === null) return

    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const diff = distance - initialDistance.current

    if (Math.abs(diff) > 30) {
      haptic('tap')
      if (diff > 0) onPinchOut?.()
      else onPinchIn?.()
      initialDistance.current = distance
    }
  }, [enabled, onPinchIn, onPinchOut])

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  }
}
