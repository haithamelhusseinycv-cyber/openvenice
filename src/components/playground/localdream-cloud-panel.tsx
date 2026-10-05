import { useEffect, useMemo, useState } from 'react'
import { LocalDreamCloudConnector, type CloudJob, type CloudOperation, type CloudVersion } from '../../connectors/localdream/cloud-connector'
import { BottomSheet } from '../ui/bottom-sheet'
import { ArtifactActions } from '../chat/artifact-actions'

const labels: Record<CloudOperation, string> = {
  auto: 'Analyze and choose', create: 'Create', edit: 'Edit photo', combine: 'Combine photos',
  masked_edit: 'Edit one region', remove_background: 'Remove background', upscale: 'Upscale 4×',
  face_detailer: 'Refine faces', mask: 'Extract selection',
}
const terminal = new Set(['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'])
const button = 'min-h-11 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40'
const field = 'min-h-11 rounded-xl bg-[#24242c] p-3 text-[16px]'
function encoded(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('Choose a photo under 25 MB.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Cannot read the selected photo.'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
}

export function LocalDreamCloudPanel() {
  const client = useMemo(() => new LocalDreamCloudConnector(localStorage), [])
  const [open, setOpen] = useState(false)
  const [operation, setOperation] = useState<CloudOperation>('auto')
  const [available, setAvailable] = useState<CloudOperation[]>([])
  const [prompt, setPrompt] = useState('')
  const [target, setTarget] = useState('')
  const [photos, setPhotos] = useState<Array<File | undefined>>([])
  const [budget, setBudget] = useState(1)
  const [job, setJob] = useState<CloudJob>()
  const [versions, setVersions] = useState<CloudVersion[]>([])
  const [version, setVersion] = useState<CloudVersion>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let refreshing = false
    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        setPending(Boolean(client.pending()))
        if (client.pending()) {
          const next = await client.reconnect(controller.signal)
          if (controller.signal.aborted) return
          setJob(next)
          if (terminal.has(next.state)) {
            const all = await client.versions(next.id, controller.signal)
            setVersions(all.versions)
            setVersion((previous) => previous && all.versions.some((v) => v.id === previous.id) ? previous : all.versions.at(-1))
          }
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Reconnect to the saved cloud job.') }
      finally { refreshing = false }
    }
    void client.capabilities(controller.signal).then((value) => {
      if (value.protocol !== 2 || value.profile !== 'Best') throw new Error('Update the Local Dream gateway.')
      setAvailable(value.operations.map((op) => op.id))
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Cloud gateway unavailable.') })
    void refresh()
    const unsubscribe = client.onWebSocketEvent((event) => {
      if (controller.signal.aborted) return
      if (event.type === 'job_update' && event.job_id) void refresh()
    })
    const fallback = window.setInterval(() => { void refresh() }, 10000)
    return () => { controller.abort(); unsubscribe(); window.clearInterval(fallback) }
  }, [open, client])
  const work = async (task: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await task() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cloud request failed.') }
    finally { setBusy(false); setPending(Boolean(client.pending())) }
  }
  const submit = () => work(async () => {
    const handles: Array<string | undefined> = []
    const inputs = operation === 'create' ? [] : operation === 'combine' || operation === 'auto' ? photos : photos.slice(0, 1)
    for (const [slot, file] of inputs.entries()) if (file) handles[slot] = (await client.upload(await encoded(file))).filename
    setVersions([]); setVersion(undefined)
    setJob(await client.submit({ operation, prompt: prompt.trim() || labels[operation], image: handles[0], references: handles.slice(1).filter((handle): handle is string => Boolean(handle)), target, max_cost_usd: budget }))
  })
  const active = job && !terminal.has(job.state)
  const needsSource = !['create', 'auto'].includes(operation)
  const needsTarget = ['mask', 'masked_edit'].includes(operation)
  const canSubmit = !busy && !pending && available.includes(operation) && (!needsSource || photos[0]) && (!(photos[1] || photos[2]) || photos[0] || operation === 'create') && (!needsTarget || target.trim()) && (operation !== 'combine' || photos[1]) && (prompt.trim() || ['mask', 'remove_background', 'upscale', 'face_detailer'].includes(operation))
  const selectedUrl = version ? client.base + version.url : undefined
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mx-3 mt-2 min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-[15px] text-white">Local Dream Cloud · Best</button>
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Local Dream Cloud">
      <div className="flex flex-col gap-4 pb-5 text-[15px] text-white">
        <p>Best quality. Original photos and saved stages stay available.</p>
        <p className="text-white/60">Uses your paid GPU session. Jobs continue when you leave; reopen to reconnect.</p>
        <label className="flex flex-col gap-1">Task<select className={field} value={operation} disabled={busy || pending} onChange={(e) => setOperation(e.target.value as CloudOperation)}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id} disabled={!available.includes(id as CloudOperation)}>{label}</option>)}</select></label>
        {operation !== 'create' && Array.from({ length: ['auto', 'combine'].includes(operation) ? 3 : 1 }, (_, slot) => <label key={slot} className="flex flex-col gap-1">{['Original photo', 'Second reference', 'Optional scene reference'][slot]}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || pending} onChange={(e) => setPhotos((old) => { const next = [...old]; next[slot] = e.target.files?.[0]; return next })} /></label>)}
        {needsTarget && <label className="flex flex-col gap-1">Region to edit or select<input className={field} value={target} maxLength={200} disabled={busy || pending} onChange={(e) => setTarget(e.target.value)} placeholder="For example: blazer" /></label>}
        <label className="flex flex-col gap-1">Describe the result<textarea className={field} rows={3} maxLength={5000} value={prompt} disabled={busy || pending} onChange={(e) => setPrompt(e.target.value)} /></label>
        <label className="flex flex-col gap-1">GPU estimate limit<select className={field} value={budget} disabled={busy || pending} onChange={(e) => setBudget(Number(e.target.value))}>{[0.1, 0.25, 0.5, 1].map((value) => <option key={value} value={value}>${value.toFixed(2)}</option>)}</select></label>
        <button type="button" className={button} disabled={!canSubmit} onClick={() => { void submit() }}>Analyze and run · Best</button>
        {job && <><p role="status" aria-live="polite">{job.message}{job.estimated_cost_usd === undefined ? '' : ' · estimated $' + job.estimated_cost_usd.toFixed(3)}</p>{job.review?.issues.map((issue, index) => <p key={index} className="text-amber-200">{issue}</p>)}</>}
        {active && <button type="button" className={button} disabled={busy} onClick={() => { void work(async () => { setJob(await client.cancel()) }) }}>Cancel cloud job</button>}
        {versions.length > 0 && <label className="flex flex-col gap-1">Versions and Undo<select className={field} value={version?.id || ''} disabled={busy} onChange={(e) => { const next = versions.find((v) => v.id === e.target.value); if (next) void work(async () => { setVersion(await client.selectVersion(job!.id, next.id)) }) }}>{versions.map((v) => <option key={v.id} value={v.id}>{v.role} · {v.id}</option>)}</select></label>}
        {selectedUrl && <figure><img src={selectedUrl} alt="Saved Local Dream version" className="w-full rounded-xl" /><ArtifactActions artifact={{ id: 'localdream-cloud-' + job?.id, kind: 'image', url: selectedUrl, mimeType: 'image/png', format: 'png', sourceTool: 'localdream.cloud' }} /></figure>}
        {job && terminal.has(job.state) && pending && <button type="button" className={button} disabled={busy} onClick={() => { void work(async () => { await client.acknowledge() }) }}>Start another task</button>}
        {error && <p role="alert" className="break-words text-rose-300">{error}</p>}
        <button type="button" className={button} onClick={() => setOpen(false)}>Close</button>
      </div>
    </BottomSheet>
  </>
}
