/**
 * Light haptic feedback for meaningful interactions.
 * Uses the Web Vibration API, which works inside the Android WebView once the
 * app declares android.permission.VIBRATE. Safe no-op everywhere else.
 */


type HapticPreset = 'tap' | 'select' | 'heavy' | 'success' | 'error' | 'warn'

const PATTERNS: Record<HapticPreset, number | number[]> = {
  tap: 8,
  select: 12,
  heavy: 24,
  success: [10, 40, 18],
  error: [28, 34, 28],
  warn: [16, 60, 16],
}



export type HapticInput = HapticPreset | number | number[]

export function haptic(pattern: HapticInput = 'tap') {
  try {
    const resolved = typeof pattern === 'string' ? PATTERNS[pattern] : pattern
    navigator.vibrate?.(resolved)
  } catch {
    // Vibration is unavailable or blocked — never surface this to the user.
  }
}
