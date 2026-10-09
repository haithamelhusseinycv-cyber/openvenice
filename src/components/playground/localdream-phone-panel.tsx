import { useEffect, useMemo, useRef, useState } from 'react'
import { LocalDreamConnector, type LocalDreamModelInfo } from '../../connectors/localdream/localdream-connector'
import { BottomSheet } from '../ui/bottom-sheet'
import { rawRgbPreview } from '../../lib/localdream-preview'
import { saveGeneratedImage } from '../../lib/image-persistence'
import { ArtifactActions } from '../chat/artifact-actions'

const button = 'min-h-11 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40'
const field = 'min-h-11 rounded-xl bg-[#24242c] p-3 text-[16px]'

export function LocalDreamPhonePanel() {
  const client = useMemo(() => new LocalDreamConnector(), [])
  const controller = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<LocalDreamModelInfo[]>([])
  const [modelId, setModelId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const refresh = async () => {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 8000)
    setError('')
    try {
      const [info, catalog] = await Promise.all([client.info(abort.signal), client.listModels(abort.signal)])
      setModels(catalog.models)
      setModelId(previous => catalog.models.some(model => model.id === previous) ? previous : catalog.models[0]?.id || '')
      setStatus(info.version + ' · ' + catalog.models.length + ' downloaded models')
    } catch { setError('Open Local Dream Easy → Models → Device link and enable host mode, then refresh.') }
    finally { clearTimeout(timer) }
  }
  useEffect(() => {
    if (open) void refresh()
    // Refresh once when this sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => () => { controller.current?.abort() }, [])
  const generate = async () => {
    if (busy) return
    const model = models.find(item => item.id === modelId)
    if (!model) return
    setBusy(true); setError(''); setImageUrl('')
    const abort = new AbortController()
    controller.current = abort
    const deadline = setTimeout(() => abort.abort(), 600_000)
    const size = model.resolutions[0] || [model.generation_size || 512, model.generation_size || 512]
    try {
      setStatus('Loading ' + model.name)
      const selected = await client.selectModel(model.id, size[0], size[1], abort.signal)
      if (!selected.ok) throw new Error('Easy rejected the selected model')
      await client.waitUntilRunning({ signal: abort.signal })
      setStatus('Generating on this phone')
      let result = ''
      for await (const event of client.generate({
        ...model.defaults, prompt, width: size[0], height: size[1], image: source || undefined,
        denoise_strength: source ? 0.65 : undefined, output_format: 'jpeg',
      }, abort.signal)) {
        if (event.type === 'error') throw new Error(event.message)
        if (event.type === 'progress') setStatus('Step ' + event.step + ' / ' + event.total_steps)
        if (event.type === 'complete') {
          result = event.format === 'raw' ? rawRgbPreview(event) : 'data:image/' + event.format + ';base64,' + event.image
        }
      }
      if (!result) throw new Error('Easy ended without an image')
      await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: result, prompt, provider: 'local-dream' })
      setImageUrl(result); setStatus('Complete · saved on this device')
    } catch (reason) {
      if (abort.signal.aborted) {
        await client.stop(model.id).catch(() => {})
        setStatus('Cancelled')
      } else setError(reason instanceof Error ? reason.message : 'Local generation failed')
    } finally { clearTimeout(deadline); controller.current = null; setBusy(false) }
  }
  const photo = async (file?: File) => {
    setError('')
    if (!file) { setSource(''); return }
    if (file.size > 16 * 1024 * 1024) { setError('Choose a photo under 16 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setSource(String(reader.result).split(',')[1])
    reader.onerror = () => setError('Cannot read this photo')
    reader.readAsDataURL(file)
  }
  return <>
    <button type="button" className="mx-3 mt-2 min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-[15px] text-white" onClick={() => setOpen(true)}>Local Dream Easy · Phone models</button>
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Local Dream Easy · Phone">
      <div className="flex flex-col gap-4 pb-5 text-[15px] text-white">
        <p>Generate and edit with downloaded models on this phone.</p>
        <p role="status">{status}</p>
        <button className={button} disabled={busy} onClick={() => { void refresh() }}>Refresh models</button>
        {!models.length && <p>Download a model in Easy’s Models screen, then refresh here.</p>}
        <label className="flex flex-col gap-1">Model<select className={field} value={modelId} disabled={busy} onChange={event => setModelId(event.target.value)}>
          {!models.length && <option value="">No downloaded models</option>}
          {models.map(model => <option key={model.id} value={model.id}>{model.name} · {model.run_on_cpu ? 'CPU' : 'NPU'}</option>)}
        </select></label>
        <label className="flex flex-col gap-1">Describe the result<textarea className={field} rows={3} maxLength={5000} value={prompt} disabled={busy} onChange={event => setPrompt(event.target.value)} /></label>
        <label className="flex flex-col gap-1">Optional source photo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void photo(event.target.files?.[0]) }} /></label>
        <button className={button} disabled={busy || !modelId || !prompt.trim()} onClick={() => { void generate() }}>Generate on this phone</button>
        {busy && <button className={button} onClick={() => controller.current?.abort()}>Cancel</button>}
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {imageUrl && <figure><img src={imageUrl} alt="Local Dream Easy result" className="w-full rounded-xl" /><ArtifactActions artifact={{ id: 'easy-phone-result', kind: 'image', url: imageUrl, mimeType: 'image/jpeg', format: 'jpeg', sourceTool: 'localdream.generate' }} /></figure>}
      </div>
    </BottomSheet>
  </>
}
