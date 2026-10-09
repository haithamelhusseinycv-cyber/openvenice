import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../ui/bottom-sheet'
import { ArtifactActions } from '../chat/artifact-actions'
import { saveGeneratedImage } from '../../lib/image-persistence'
import { formatVeniceError } from '../../lib/venice-client'
import { imageCloud, planImageWorkflow, produceImage, reviewImage } from '../../agent/image-workflow-service'
import type { ImageWorkflowPlan } from '../../agent/image-workflow-planner'
const button = 'min-h-11 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40'
const terminal = new Set(['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'])
const KEY = 'chilli.image-studio.plan.v1'
export function IntelligentImageStudio() {
  const [open, setOpen] = useState(false), [prompt, setPrompt] = useState(''), [photos, setPhotos] = useState<string[]>([])
  const [plan, setPlan] = useState<ImageWorkflowPlan>(), [status, setStatus] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [cloudActive, setCloudActive] = useState(false)
  const [versions, setVersions] = useState<Array<{ label: string; uri: string }>>([]), [selected, setSelected] = useState(0)
  const [issues, setIssues] = useState<string[]>([]), abort = useRef<AbortController | null>(null), owner = useRef(false)
  useEffect(() => () => { abort.current?.abort() }, [])
  useEffect(() => {
    if (!open) return
    let dead = false, polling = false
    const controller = new AbortController(), client = imageCloud()
    let loadedJob = ""
    const poll = async () => {
      if (polling || !client.pending()) return
      polling = true
      try {
        const job = await client.reconnect(controller.signal)
        if (dead) return
        setCloudActive(!terminal.has(job.state)); setStatus(job.message); setIssues(job.review?.issues || [])
        try { const stored = JSON.parse(localStorage.getItem(KEY) || 'null') as ImageWorkflowPlan | null; if (stored) setPlan(stored) } catch { /* ignore malformed metadata */ }
        if (terminal.has(job.state) && job.images.length && loadedJob !== job.id) {
          const all = await client.versions(job.id, controller.signal)
          if (dead) return
          setVersions(all.versions.map(v => ({ label: v.role + ' · ' + v.id, uri: client.base + v.url })))
          setSelected(Math.max(0, all.versions.length - 1)); loadedJob = job.id
        }
      } catch (e) { if (!dead) setError(formatVeniceError(e)) }
      finally { polling = false }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 5000)
    return () => { dead = true; controller.abort(); clearInterval(timer) }
  }, [open])
  const upload = async (files: FileList | null) => {
    if (!files) return
    setError(''); setPlan(undefined)
    try {
      if (files.length > 3) throw new Error('Choose one original and up to two references')
      const next: string[] = []
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 16 * 1024 * 1024) throw new Error('Choose PNG, JPEG or WebP photos under 16 MB')
        next.push(await new Promise<string>((resolve, reject) => {
          const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Cannot read the photo')); r.readAsDataURL(file)
        }))
      }
      setPhotos(next)
    } catch (e) { setError(formatVeniceError(e)) }
  }
  const run = async () => {
    if (busy || owner.current || cloudActive) return
    const client = imageCloud()
    if (client.pending()) { setError('Finish or acknowledge the saved cloud job in Advanced before starting another task'); return }
    owner.current = true; setBusy(true); setError(''); setIssues([])
    const controller = new AbortController(); abort.current = controller
    const deadline = setTimeout(() => controller.abort(), 600000)
    let candidate = '', nextPlan: ImageWorkflowPlan | undefined
    try {
      setStatus('Understand · inspecting pixels and reasoning about the photos')
      nextPlan = await planImageWorkflow(prompt, photos, controller.signal)
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      setPlan(nextPlan); localStorage.setItem(KEY, JSON.stringify(nextPlan))
      const originals = photos.map((uri, i) => ({ label: i ? 'Reference ' + i : 'Original', uri }))
      // Originals are saved independently; processing never overwrites them.
      for (const original of originals) await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: original.uri, prompt: original.label + ' · ' + prompt, provider: 'original' })
      setVersions(originals); setSelected(0)
      const result = await produceImage(nextPlan, prompt, photos, controller.signal, setStatus)
      if (result.cloudJob) { setCloudActive(true); setStatus('Plan → Configure → Produce → Review · cloud job saved; reopen to reconnect'); return }
      if (!result.output) { setStatus('Finish · analysis complete'); return }
      candidate = result.output
      const outputVersion = { label: 'Candidate · ' + nextPlan.engine, uri: candidate }
      setVersions([...originals, outputVersion]); setSelected(originals.length)
      await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: candidate, prompt, provider: nextPlan.engine })
      setStatus('Review · comparing the result with your request and originals')
      try {
        const review = await reviewImage(prompt, photos, candidate, controller.signal)
        setIssues(review.issues)
        setStatus(review.passed ? 'Finish · visual checks passed; image saved' : 'Review needed · candidate saved; refine the noted issues')
      } catch (e) {
        setIssues(['Visual review could not be completed: ' + formatVeniceError(e)])
        setStatus('Review needed · candidate saved')
      }
    } catch (e) {
      if (controller.signal.aborted) {
        if (client.pending()) await client.cancel().catch(() => { setError('Reconnect to confirm cloud cancellation') })
        setStatus(candidate ? 'Review interrupted · candidate saved' : 'Cancelled')
      } else { setError(formatVeniceError(e)); setStatus('Workflow stopped') }
    } finally { clearTimeout(deadline); abort.current = null; owner.current = false; setBusy(false) }
  }
  const cancel = async () => {
    abort.current?.abort()
    if (cloudActive) {
      try { const job = await imageCloud().cancel(); setStatus(job.message); setCloudActive(!terminal.has(job.state)) }
      catch (e) { setError(formatVeniceError(e)) }
    }
  }
  const output = versions[selected]
  return <>
    <button className="mx-3 mt-2 min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-[15px] text-white" onClick={() => setOpen(true)}>Chilli Studio · Intelligent workflow</button>
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Chilli Studio">
      <div className="flex flex-col gap-4 pb-5 text-[15px] text-white">
        <p>Describe the result. Chilli understands the photos, chooses the workflow and model settings, then reviews the output. Best quality.</p>
        <label>Original photo and optional references<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || cloudActive} onChange={e => { void upload(e.target.files) }} /></label>
        {photos.length > 0 && <div className="flex gap-2">{photos.map((uri, i) => <figure key={i} className="w-1/3"><img src={uri} alt={i ? 'Reference ' + i : 'Original'} className="max-h-32 rounded-xl object-contain" /><figcaption>{i ? 'Reference ' + i : 'Original'}</figcaption></figure>)}</div>}
        <label className="flex flex-col gap-1">What should Chilli do?<textarea rows={3} maxLength={5000} className="min-h-11 rounded-xl bg-[#24242c] p-3 text-[16px]" value={prompt} disabled={busy || cloudActive} onChange={e => { setPrompt(e.target.value); setPlan(undefined) }} placeholder="For example: improve this portrait while preserving natural skin and appearance" /></label>
        <p className="text-white/60">Cloud Easy estimate limit: $0.25 per job. Venice uses your account credits.</p>
        <button className={button} disabled={busy || cloudActive || !prompt.trim()} onClick={() => { void run() }}>Understand and run · Best</button>
        {(busy || cloudActive) && <button className={button} onClick={() => { void cancel() }}>Stop</button>}
        <p role="status" aria-live="polite">{status}</p>
        {plan && <details open><summary>Workflow and settings</summary><p>{plan.operation} · {plan.engine} · {plan.model}</p><p>{plan.reason}</p>{plan.preserve.length > 0 && <p>Preserve: {plan.preserve.join(', ')}</p>}<p className="break-words text-white/60">{Object.entries(plan.settings).filter(([,v]) => v !== undefined && v !== '').map(([k,v]) => k + ': ' + String(v)).join(' · ')}</p>{plan.issues.map((v,i) => <p key={i}>{v}</p>)}</details>}
        {issues.map((issue, i) => <p key={i} className="text-amber-200">{issue}</p>)}
        {versions.length > 0 && <label>Versions and Undo<select className="min-h-11 w-full rounded-xl bg-[#24242c] p-3" value={selected} onChange={e => setSelected(Number(e.target.value))}>{versions.map((v,i) => <option key={i} value={i}>{v.label}</option>)}</select></label>}
        {output && <figure><img src={output.uri} alt={output.label} className="w-full rounded-xl" /><ArtifactActions artifact={{ id: 'studio-version-' + selected, kind: 'image', url: output.uri, mimeType: 'image/png', sourceTool: 'chilli.studio' }} /></figure>}
        {output && !busy && !cloudActive && <button className={button} onClick={() => { void (async () => { const response = await fetch(output.uri); if (!response.ok) throw new Error("Cannot load this version"); const blob = await response.blob(); const uri = await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Cannot read this version")); r.readAsDataURL(blob) }); setPhotos([uri]); setPrompt(prompt + (issues.length ? '\nRepair these visible issues while preserving everything else: ' + issues.join('; ') : '\nRefine this result while preserving appearance and composition')); setPlan(undefined); setStatus('Describe any further changes, then run') })().catch(e => setError(formatVeniceError(e))) }}>Refine this version</button>}
        {imageCloud().pending() && !cloudActive && !busy && <button className={button} onClick={() => { void imageCloud().acknowledge().then(() => { localStorage.removeItem(KEY); setStatus('Ready for another task') }).catch(e => setError(formatVeniceError(e))) }}>Finish saved cloud job</button>}
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        <button className={button} onClick={() => setOpen(false)}>Close</button>
      </div>
    </BottomSheet>
  </>
}
