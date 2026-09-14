import { useEffect, useState } from 'react'
import { requestBiometricGate } from '../../lib/auth-gate'
import { haptic } from '../../lib/haptics'

interface LockScreenProps {
  onUnlocked: () => void
}

/**
 * Premium front-door lock: Noor-branded gate shown before any conversation
 * content when the biometric lock is enabled on a native Android build.
 * Devices without biometrics never reach this screen (fall-open in native).
 */
export function LockScreen({ onUnlocked }: LockScreenProps) {
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasCancelled, setWasCancelled] = useState(false)

  const attempt = async () => {
    if (unlocking) return
    setUnlocking(true)
    setError(null)
    try {
      await requestBiometricGate()
      haptic('success')
      onUnlocked()
    } catch (cause) {
      haptic('error')
      setWasCancelled(true)
      setError(cause instanceof Error && cause.message ? cause.message : 'Unlock failed')
    } finally {
      setUnlocking(false)
    }
  }

  useEffect(() => {
    haptic('heavy')
    void attempt()
    // Auto-prompt once on mount; retries are user-initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="ambient-mesh fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 bg-[#0a0a0c] px-6">
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative h-24 w-24">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[var(--color-accent)]/20 blur-2xl" />
          <div className="relative h-full w-full overflow-hidden rounded-full border border-white/[0.14] shadow-[var(--shadow-3)]">
            <img src="/nour-portrait.png" alt="" className="h-full w-full object-cover object-[50%_18%]" />
          </div>
        </div>
        <div className="text-center">
          <div className="text-[19px] font-semibold tracking-[-0.01em] text-white">OpenVenice</div>
          <div className="mt-1 text-[13.5px] text-white/50">Locked · unlock to continue</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { haptic('tap'); void attempt() }}
        disabled={unlocking}
        className="flex min-h-13 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-semibold text-black shadow-[var(--shadow-2)] transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2.5" />
          <path d="M8 10V7a4 4 0 018 0v3" />
          <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
        {unlocking ? 'Waiting for you…' : 'Unlock'}
      </button>

      {error && (
        <div role="alert" className="max-w-[36ch] text-center text-[13px] leading-relaxed text-white/55">
          {wasCancelled ? 'Unlock cancelled — tap Unlock to try again.' : error}
        </div>
      )}

      <div className="text-[11.5px] text-white/30">Protected with your device biometrics</div>
    </div>
  )
}
