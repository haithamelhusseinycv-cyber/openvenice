import { useEffect, useMemo, useState } from 'react'
import { useVoiceStore } from '../../stores/voice-store'
import { listenForVoice, speakVoice, voiceLocaleShortLabel } from '../../lib/voice-chat'
import { runDeviceDiagnostics, type DiagnosticResult } from '../../lib/device-diagnostics'

interface DeviceDiagnosticsDialogProps {
  open: boolean
  onClose: () => void
}

function statusClass(status: DiagnosticResult['status']) {
  if (status === 'pass') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'warn') return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
  return 'border-rose-400/20 bg-rose-400/10 text-rose-200'
}

function statusLabel(status: DiagnosticResult['status']) {
  if (status === 'pass') return 'PASS'
  if (status === 'warn') return 'OPTIONAL'
  return 'FAIL'
}

export function DeviceDiagnosticsDialog({ open, onClose }: DeviceDiagnosticsDialogProps) {
  const locale = useVoiceStore((s) => s.locale)
  const setLocale = useVoiceStore((s) => s.setLocale)
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [running, setRunning] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceResult, setVoiceResult] = useState('')

  const summary = useMemo(() => {
    const pass = results.filter((item) => item.status === 'pass').length
    const warn = results.filter((item) => item.status === 'warn').length
    const fail = results.filter((item) => item.status === 'fail').length
    return { pass, warn, fail }
  }, [results])

  const runAll = async () => {
    setRunning(true)
    try {
      setResults(await runDeviceDiagnostics())
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setVoiceResult('')
    void runAll()
    // Run only when the sheet opens. The explicit Re-run button refreshes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const testMic = async (testLocale: 'en-US' | 'ar-EG') => {
    setVoiceBusy(true)
    setVoiceResult(`Listening · ${voiceLocaleShortLabel(testLocale)}`)
    try {
      setLocale(testLocale)
      const result = await listenForVoice(testLocale)
      setVoiceResult(`${voiceLocaleShortLabel(testLocale)} heard: ${result.text}`)
    } catch (error) {
      setVoiceResult(error instanceof Error ? `Mic test failed: ${error.message}` : 'Mic test failed')
    } finally {
      setVoiceBusy(false)
    }
  }

  const testSpeaker = async () => {
    setVoiceBusy(true)
    setVoiceResult(`Speaking · ${voiceLocaleShortLabel(locale)}`)
    try {
      const text = locale === 'ar-EG'
        ? 'أهلاً، أنا نور. اختبار الصوت المصري شغال.'
        : 'Hi, I am Noor. English voice output is working.'
      await speakVoice(text, locale)
      setVoiceResult(`Speaker test completed · ${voiceLocaleShortLabel(locale)}`)
    } catch (error) {
      setVoiceResult(error instanceof Error ? `Speaker test failed: ${error.message}` : 'Speaker test failed')
    } finally {
      setVoiceBusy(false)
    }
  }

  const copyReport = async () => {
    const report = [
      `OpenVenice Noor device acceptance · ${new Date().toISOString()}`,
      ...results.map((item) => `${statusLabel(item.status)} | ${item.label} | ${item.detail}`),
      voiceResult ? `VOICE | ${voiceResult}` : '',
    ].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(report)
    setVoiceResult('Diagnostic report copied.')
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Device diagnostics">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close device diagnostics" onClick={onClose} />
      <section className="relative flex max-h-[88dvh] w-full max-w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-white/[0.1] bg-[#111116] shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-white">Noor device acceptance</h2>
            <p className="text-[12px] text-white/40">Core Android readiness · optional local tools listed separately</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-center"><div className="text-[18px] font-semibold text-emerald-200">{summary.pass}</div><div className="text-[10px] uppercase tracking-wide text-white/35">Pass</div></div>
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2 text-center"><div className="text-[18px] font-semibold text-amber-100">{summary.warn}</div><div className="text-[10px] uppercase tracking-wide text-white/35">Optional</div></div>
            <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2 text-center"><div className="text-[18px] font-semibold text-rose-200">{summary.fail}</div><div className="text-[10px] uppercase tracking-wide text-white/35">Fail</div></div>
          </div>

          <div className="flex flex-col gap-2">
            {results.map((item) => (
              <div key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                <span className={`mt-0.5 shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold tracking-[0.08em] ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white/85">{item.label}</div>
                  <div className="mt-0.5 break-words text-[11.5px] leading-relaxed text-white/42">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45">Live voice test</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button type="button" disabled={voiceBusy} onClick={() => void testMic('en-US')} className="min-h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 text-[12px] font-medium text-white/70 disabled:opacity-40">Mic EN</button>
              <button type="button" disabled={voiceBusy} onClick={() => void testMic('ar-EG')} className="min-h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 text-[12px] font-medium text-white/70 disabled:opacity-40">Mic مصري</button>
              <button type="button" disabled={voiceBusy} onClick={() => void testSpeaker()} className="min-h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 text-[12px] font-medium text-white/70 disabled:opacity-40">Speaker</button>
            </div>
            {voiceResult && <div className="mt-2 break-words rounded-lg bg-black/20 px-2.5 py-2 text-[11.5px] leading-relaxed text-white/55">{voiceResult}</div>}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" disabled={running} onClick={() => void runAll()} className="min-h-11 flex-1 rounded-xl bg-white px-3 text-[13px] font-semibold text-black disabled:opacity-50">{running ? 'Checking…' : 'Re-run checks'}</button>
            <button type="button" disabled={results.length === 0} onClick={() => void copyReport()} className="min-h-11 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-[13px] font-medium text-white/70 disabled:opacity-40">Copy report</button>
          </div>

          <p className="mt-3 px-1 text-[10.5px] leading-relaxed text-white/30">No private-Qwen server is required for Noor. Local Dream and FaceFusion are optional add-ons. Microphone and speaker tests run only when you tap them.</p>
        </div>
      </section>
    </div>
  )
}
