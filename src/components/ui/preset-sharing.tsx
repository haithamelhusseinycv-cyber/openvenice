import { shareUrl } from '../../lib/share-url'
import { useState, useMemo } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

type SharedPreset = { name: string; features: string[]; settings: Record<string, unknown> }
export interface PresetSharingProps {
  preset: {
    name: string
    features: string[]
    settings: Record<string, unknown>
  }
  onImport?: (preset: SharedPreset) => void
}

function toBase64Url(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const safe = padded.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(safe), value => value.charCodeAt(0)))
}

export function encodePreset(preset: SharedPreset): string {
  try {
    const json = JSON.stringify(preset)
    return toBase64Url(json)
  } catch {
    return ''
  }
}

const MAX_URL_LENGTH = 2000

export function decodePreset(encoded: string): SharedPreset | null {
  try {
    const json = fromBase64Url(encoded)
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.name !== 'string' || !Array.isArray(parsed.features) || !parsed.features.every((value: unknown) => typeof value === 'string') || !parsed.settings || typeof parsed.settings !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function buildShareUrl(encoded: string): string {
  return shareUrl('preset', encoded)
}

export function PresetSharing({ preset, onImport }: PresetSharingProps) {
  const [copied, setCopied] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importInput, setImportInput] = useState('')
  const [importError, setImportError] = useState('')

  const encoded = useMemo(() => encodePreset(preset), [preset])
  const shareUrl = useMemo(() => buildShareUrl(encoded), [encoded])
  const urlTooLong = shareUrl.length > MAX_URL_LENGTH

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      haptic('success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      haptic('error')
    }
  }

  const shareViaApi = async () => {
    if (!canShare) return
    try {
      await navigator.share({
        title: `Preset: ${preset.name}`,
        text: `Check out this preset configuration: ${preset.name}`,
        url: shareUrl,
      })
      haptic('success')
    } catch {
      // User cancelled or share failed
    }
  }

  const handleImport = () => {
    const trimmed = importInput.trim()
    if (!trimmed) {
      setImportError('Paste a preset URL or encoded string')
      return
    }

    // Try to extract encoded string from URL
    let encodedStr = trimmed
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get('preset')
      if (param) encodedStr = param
    } catch {
      // Not a URL, use as-is
    }

    const decoded = decodePreset(encodedStr)
    if (!decoded) {
      setImportError('Invalid preset data')
      haptic('error')
      return
    }

    setImportError('')
    haptic('success')
    onImport?.(decoded)
    setShowImport(false)
    setImportInput('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
        Preset Sharing
      </div>

      {/* Current preset details */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span className="text-[13px] font-medium text-white/80">{preset.name}</span>
        </div>

        <div className="rounded-lg bg-black/20 p-2 mb-2 overflow-x-auto">
          <code className="text-[11px] text-white/40 break-all">
            {shareUrl.slice(0, 120)}
            {shareUrl.length > 120 ? '...' : ''}
          </code>
        </div>

        {urlTooLong && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-2 text-[11px] text-amber-300/80">
            Warning: Encoded preset URL exceeds {MAX_URL_LENGTH} characters ({shareUrl.length} chars). Some platforms may not accept it.
          </div>
        )}

        {/* Preset contents */}
        <div className="mb-3">
          <span className="text-[10px] text-white/25 uppercase tracking-wider block mb-1.5">
            Features ({preset.features.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {preset.features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <span className="text-[10px] text-white/25 uppercase tracking-wider block mb-1.5">
            Settings
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-[12px]">
            {Object.entries(preset.settings).map(([key, value]) => (
              <div key={key}>
                <span className="text-white/40">{key}: </span>
                <span className="text-white/60">
                  {typeof value === 'string' ? value.slice(0, 20) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className={cn(
              'flex-1 rounded-lg py-2 text-[13px] font-medium min-h-10 transition-colors',
              copied
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white',
            )}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {canShare && (
            <button
              type="button"
              onClick={shareViaApi}
              className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-white/50 hover:text-white/70 min-h-10 transition-colors"
            >
              Share
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              haptic('tap')
              setShowImport(!showImport)
            }}
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-white/50 hover:text-white/70 min-h-10 transition-colors"
          >
            Import
          </button>
        </div>
      </div>

      {/* Import section */}
      {showImport && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <span className="text-[11px] text-white/30 uppercase tracking-wider block mb-2">
            Import Preset
          </span>

          <textarea
            value={importInput}
            onChange={(e) => {
              setImportInput(e.target.value)
              setImportError('')
            }}
            placeholder="Paste preset URL or encoded string..."
            className="w-full rounded-lg bg-black/20 border border-white/[0.08] px-3 py-2 text-[12px] text-white/70 placeholder:text-white/25 resize-none min-h-[100px] focus:outline-none focus:border-white/[0.16] transition-colors"
          />

          {importError && (
            <div className="text-[11px] text-red-400/80 mt-1">{importError}</div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleImport}
              className="flex-1 rounded-lg bg-white/10 py-2 text-[13px] font-medium text-white/70 hover:bg-white/15 hover:text-white min-h-10 transition-colors"
            >
              Import Preset
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImport(false)
                setImportInput('')
                setImportError('')
              }}
              className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-white/50 hover:text-white/70 min-h-10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
