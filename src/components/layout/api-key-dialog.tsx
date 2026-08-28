import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { validateVeniceApiKey } from '../../lib/venice-auth-check'
import { VeniceLogo } from '../ui/logo'
import { toast } from '../../stores/toast-store'

const MIN_PASSPHRASE = 8

export function ApiKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apiKey, hasEncrypted, setApiKey, unlock, clearApiKey } = useAuthStore()
  const [value, setValue] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceConnect, setForceConnect] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, busy])

  useEffect(() => {
    if (!open) {
      setError(null)
      setBusy(false)
      setForceConnect(false)
      setValue('')
      setPassphrase('')
      setRemember(false)
    }
  }, [open])

  if (!open) return null

  const isUnlockMode = hasEncrypted && !apiKey && !forceConnect
  const passphraseTooShort = remember && passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE

  const handleConnect = async () => {
    const candidate = value.trim()
    if (!candidate || busy) return
    if (remember) {
      if (!passphrase) { setError('Passphrase required to remember this key.'); return }
      if (passphrase.length < MIN_PASSPHRASE) { setError(`Passphrase must be at least ${MIN_PASSPHRASE} characters.`); return }
    }

    setBusy(true)
    setError(null)
    try {
      await validateVeniceApiKey(candidate)
      await setApiKey(candidate, remember ? { passphrase } : undefined)
      toast.success(remember ? 'Key verified and saved (encrypted)' : 'Key verified for this session')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify or save key')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (!passphrase || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await unlock(passphrase)
      if (ok) {
        toast.success('Key unlocked')
        onClose()
      } else {
        setError('Wrong passphrase. Try again or use a different key.')
      }
    } finally {
      setBusy(false)
    }
  }

  const titleId = 'apikey-dialog-title'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button aria-label="Close dialog" disabled={busy} className="absolute inset-0 bg-black/75 backdrop-blur-sm disabled:cursor-wait" onClick={onClose} />
      <div
        className="relative bg-[#0e0e0e] border border-white/[0.1] rounded-xl p-6 w-full max-w-sm mx-4 animate-scale-in shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
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
                : 'The key is verified with Venice before it is stored.'}
            </p>
          </div>
        </div>

        {isUnlockMode ? (
          <div>
            <label htmlFor="apikey-passphrase" className="sr-only">Passphrase</label>
            <input
              id="apikey-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Passphrase"
              className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors placeholder:text-white/25"
              autoFocus
              autoComplete="current-password"
              disabled={busy}
              onKeyDown={(event) => { if (event.key === 'Enter') void handleUnlock() }}
            />
          </div>
        ) : (
          <>
            <label htmlFor="apikey-input" className="sr-only">Venice API key</label>
            <input
              id="apikey-input"
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="sk-..."
              className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors font-mono placeholder:text-white/25"
              autoFocus
              autoComplete="off"
              disabled={busy}
              onKeyDown={(event) => { if (event.key === 'Enter' && !remember) void handleConnect() }}
            />
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
              . New keys stay in this browser session unless you enable encrypted persistence below.
            </p>

            <label className="flex items-center gap-2 mt-4 text-[14px] text-white/65 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="accent-white"
                disabled={busy}
              />
              Remember across sessions (encrypted with passphrase)
            </label>

            {remember && (
              <div className="mt-2">
                <label htmlFor="apikey-new-passphrase" className="sr-only">Encryption passphrase</label>
                <input
                  id="apikey-new-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder={`Passphrase (min ${MIN_PASSPHRASE} chars)`}
                  className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-[16px] text-white outline-none focus:border-white/[0.25] transition-colors placeholder:text-white/25"
                  autoComplete="new-password"
                  disabled={busy}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !passphraseTooShort) void handleConnect() }}
                />
                {passphraseTooShort && (
                  <p className="text-[12px] text-yellow-300/85 mt-1">Use at least {MIN_PASSPHRASE} characters.</p>
                )}
                <p className="text-[12px] text-white/40 mt-1">
                  Encrypted with AES-GCM via PBKDF2 (250k iterations). The passphrase is never persisted.
                </p>
              </div>
            )}
          </>
        )}

        {isUnlockMode && (
          <button
            onClick={() => { setForceConnect(true); setError(null); setPassphrase('') }}
            disabled={busy}
            className="mt-3 text-[13px] text-white/55 hover:text-white/85 transition-colors underline underline-offset-2 disabled:opacity-40"
          >
            Use a different key
          </button>
        )}

        {error && <p role="alert" className="text-[13px] text-red-300 mt-3">{error}</p>}

        <div className="flex flex-wrap gap-2 mt-6 justify-end">
          {(apiKey || hasEncrypted) && (
            <button
              onClick={() => { clearApiKey(); setValue(''); setPassphrase(''); setRemember(false); toast.info('API key cleared') }}
              disabled={busy}
              className="px-3 py-1.5 text-[14px] text-white/55 hover:text-red-300 transition-colors disabled:opacity-40"
            >
              Disconnect
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 text-[14px] text-white/55 hover:text-white/85 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={() => { void (isUnlockMode ? handleUnlock() : handleConnect()) }}
            disabled={busy || (isUnlockMode ? !passphrase : !value.trim() || passphraseTooShort)}
            aria-busy={busy || undefined}
            className="px-4 py-1.5 text-[14px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 focus-visible:outline-offset-2"
          >
            {busy ? (isUnlockMode ? 'Unlocking…' : 'Verifying…') : isUnlockMode ? 'Unlock' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
