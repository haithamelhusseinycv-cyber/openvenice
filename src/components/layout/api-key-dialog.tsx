import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { VeniceLogo } from '../ui/logo'
import { toast } from '../../stores/toast-store'
import { formatVeniceError, validateVeniceApiKey } from '../../lib/venice-client'

const MIN_PASSPHRASE = 8

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c6.5 0 10 8 10 8a17.3 17.3 0 0 1-2.1 3.2" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.1-.9" />
    </svg>
  )
}

function isAndroidApp() {
  if (typeof window === 'undefined') return false
  const runtime = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }).Capacitor
  if (!runtime) return false
  if (runtime.isNativePlatform && !runtime.isNativePlatform()) return false
  return runtime.getPlatform?.() === 'android'
}

export function ApiKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apiKey, hasEncrypted, deviceRemembered, setApiKey, unlock, clearApiKey } = useAuthStore()
  const [value, setValue] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(deviceRemembered)
  const [showKey, setShowKey] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceConnect, setForceConnect] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const android = isAndroidApp()

  useEffect(() => {
    if (!open) return
    setKeepSignedIn(deviceRemembered)
    setShowKey(false)
    setShowPassphrase(false)
  }, [open, deviceRemembered])

  // Trap keyboard focus inside the modal and restore it to the opener.
  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      returnFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const isUnlockMode = hasEncrypted && !apiKey && !forceConnect
  const passphraseTooShort = remember && passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE

  const handleConnect = async () => {
    if (!value.trim()) return
    if (remember) {
      if (!passphrase) { setError('Passphrase required to remember this key.'); return }
      if (passphrase.length < MIN_PASSPHRASE) { setError(`Passphrase must be at least ${MIN_PASSPHRASE} characters.`); return }
    }
    setBusy(true)
    setError(null)
    try {
      await validateVeniceApiKey(value.trim())
      await setApiKey(
        value.trim(),
        keepSignedIn ? { device: true } : remember ? { passphrase } : undefined,
      )
      toast.success(
        keepSignedIn
          ? 'Key saved securely on this device'
          : remember
            ? 'Key saved (encrypted)'
            : 'Key set for this session',
      )
      onClose()
    } catch (e) {
      setError(formatVeniceError(e))
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (!passphrase) return
    setBusy(true)
    setError(null)
    const ok = await unlock(passphrase)
    setBusy(false)
    if (ok) { toast.success('Key unlocked'); onClose() }
    else setError('Wrong passphrase. Try again or use a different key.')
  }

  const titleId = 'apikey-dialog-title'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button aria-label="Close dialog" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative bg-[#0e0e0e] border border-white/[0.1] rounded-xl p-6 w-full max-w-sm mx-4 animate-scale-in shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <VeniceLogo size={26} />
          <div>
            <h2 id={titleId} className="text-[17px] font-semibold text-white/90">
              {isUnlockMode ? 'Unlock saved key' : 'Connect to Venice'}
            </h2>
            <p className="text-[13px] text-white/50">
              {isUnlockMode
                ? 'Enter your passphrase to decrypt your saved key.'
                : android
                  ? 'You can keep the key securely on this phone and sign in automatically.'
                  : 'Stored in this tab only by default. Encrypt to keep across sessions.'}
            </p>
          </div>
        </div>

        {isUnlockMode ? (
          <div>
            <label htmlFor="apikey-passphrase" className="sr-only">Passphrase</label>
            <div className="relative">
              <input
                id="apikey-passphrase"
                name="openvenice-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 pr-12 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors placeholder:text-white/25"
                autoFocus
                autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock() }}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((current) => !current)}
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                aria-pressed={showPassphrase}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/45 hover:text-white/85"
              >
                <EyeIcon open={showPassphrase} />
              </button>
            </div>
            <p className="mt-2 text-[12px] text-white/35">Your password manager may also offer to save or autofill this passphrase.</p>
          </div>
        ) : (
          <>
            <label htmlFor="apikey-input" className="sr-only">Venice API key</label>
            <div className="relative">
              <input
                id="apikey-input"
                name="openvenice-api-key"
                type={showKey ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 pr-12 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors font-mono placeholder:text-white/25"
                autoFocus
                autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === 'Enter' && !remember) handleConnect() }}
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                aria-pressed={showKey}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/45 hover:text-white/85"
              >
                <EyeIcon open={showKey} />
              </button>
            </div>
            <p className="text-[13px] text-white/40 mt-2">
              Get a key at{' '}
              <a
                href="https://venice.ai/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/65 hover:text-white underline underline-offset-2"
              >
                venice.ai/settings/api
              </a>
              .
            </p>

            {android && (
              <label className="flex items-start gap-2 mt-4 text-[14px] text-white/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => {
                    setKeepSignedIn(e.target.checked)
                    if (e.target.checked) setRemember(false)
                  }}
                  className="mt-0.5 accent-white"
                />
                <span>
                  <span className="block">Keep me signed in on this device</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-white/35">Saved with Android Keystore and restored automatically when OpenVenice starts.</span>
                </span>
              </label>
            )}

            <label className="flex items-center gap-2 mt-3 text-[13px] text-white/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked)
                  if (e.target.checked) setKeepSignedIn(false)
                }}
                className="accent-white"
              />
              Use a passphrase-protected saved key instead
            </label>

            {remember && (
              <div className="mt-2">
                <label htmlFor="apikey-new-passphrase" className="sr-only">Encryption passphrase</label>
                <div className="relative">
                  <input
                    id="apikey-new-passphrase"
                    name="openvenice-new-passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={`Passphrase (min ${MIN_PASSPHRASE} chars)`}
                    className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 pr-12 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors placeholder:text-white/25"
                    autoComplete="new-password"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !passphraseTooShort) handleConnect() }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((current) => !current)}
                    aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                    aria-pressed={showPassphrase}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/45 hover:text-white/85"
                  >
                    <EyeIcon open={showPassphrase} />
                  </button>
                </div>
                {passphraseTooShort && (
                  <p className="text-[12px] text-yellow-300/85 mt-1">Use at least {MIN_PASSPHRASE} characters.</p>
                )}
                <p className="text-[12px] text-white/40 mt-1">
                  Encrypted with AES-GCM via PBKDF2 (250k iterations). Your browser/password manager can offer to remember the passphrase.
                </p>
              </div>
            )}
          </>
        )}

        {isUnlockMode && (
          <button
            onClick={() => { setForceConnect(true); setError(null); setPassphrase('') }}
            className="mt-3 text-[13px] text-white/55 hover:text-white/85 transition-colors underline underline-offset-2"
          >
            Use a different key
          </button>
        )}

        {error && <p role="alert" className="text-[13px] text-red-300 mt-3">{error}</p>}

        <div className="flex flex-wrap gap-2 mt-6 justify-end">
          {(apiKey || hasEncrypted || deviceRemembered) && (
            <button
              onClick={() => { clearApiKey(); setValue(''); setPassphrase(''); setRemember(false); setKeepSignedIn(false); toast.info('API key cleared') }}
              className="px-3 py-1.5 text-[14px] text-white/55 hover:text-red-300 transition-colors"
            >
              Disconnect
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 text-[14px] text-white/55 hover:text-white/85 transition-colors">
            Cancel
          </button>
          <button
            onClick={isUnlockMode ? handleUnlock : handleConnect}
            disabled={busy || (isUnlockMode ? !passphrase : !value.trim() || passphraseTooShort)}
            aria-busy={busy || undefined}
            className="px-4 py-1.5 text-[14px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 focus-visible:outline-offset-2"
          >
            {busy ? 'Validating…' : isUnlockMode ? 'Unlock' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
