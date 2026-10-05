import { LocalDreamCloudPanel } from './localdream-cloud-panel'
import { useEffect, useRef, useState } from 'react'
import { LocalDreamConnector, type LocalDreamCatalog, type LocalDreamStatus } from '../../connectors/localdream/localdream-connector'
import { BottomSheet } from '../ui/bottom-sheet'
import { rawRgbPreview } from '../../lib/localdream-preview'
import { ArtifactActions } from '../chat/artifact-actions'

const connector = new LocalDreamConnector()
const buttonClass = 'min-h-11 rounded-xl border border-white/20 px-4 py-2 text-[15px] font-medium disabled:opacity-40'

type RawImage = { image: string; width: number; height: number }

export function LocalDreamPanel() {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<LocalDreamCatalog>()
  const [model, setModel] = useState('')
  const [upscaler, setUpscaler] = useState('')
  const [status, setStatus] = useState<LocalDreamStatus>()
  const [online, setOnline] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [prompt, setPrompt] = useState('A ceramic coffee mug on a wooden table in daylight')
  const [steps, setSteps] = useState(12)
  const [raw, setRaw] = useState<RawImage>()
  const [preview, setPreview] = useState('')
  const [upscaled, setUpscaled] = useState<{ image: string; width: number; height: number }>()
  const [timing, setTiming] = useState('')
  const operation = useRef<AbortController | null>(null)

  useEffect(() => () => operation.current?.abort(), [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let refreshing = false
    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const next = await connector.status(controller.signal)
        setStatus(next)
        if (next.state === 'running') {
          try {
            await connector.waitUntilRunning({ timeoutMs: 1500, signal: controller.signal })
            if (!controller.signal.aborted) setOnline(true)
          } catch {
            if (!controller.signal.aborted) setOnline(false)
          }
        } else setOnline(false)
      } catch {
        if (!controller.signal.aborted) { setOnline(false); setStatus({ state: 'offline' }) }
      } finally { refreshing = false }
    }
    void connector.listModels(controller.signal).then((value) => {
      setCatalog(value)
      setModel((previous) => previous || value.models.find((item) => item.id === 'absolutereality')?.id || value.models[0]?.id || '')
      setUpscaler((previous) => previous || value.upscalers[0]?.id || '')
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Model catalog is unavailable') })
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 2500)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [open])

  const run = async (label: string, work: (signal: AbortSignal) => Promise<void>) => {
    if (operation.current) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(label); setError(''); setProgress('')
    try { await work(controller.signal) }
    catch (reason) { setError(controller.signal.aborted ? 'Cancelled. Stop the model to release its memory.' : reason instanceof Error ? reason.message : 'Local Dream request failed') }
    finally { operation.current = null; setBusy('') }
  }

  const start = () => run('Loading model', async (signal) => {
    const selected = catalog?.models.find((item) => item.id === model)
    if (!selected) throw new Error('Select a downloaded model first')
    const size = selected.generation_size || 512
    const started = Date.now()
    setOnline(false); setStatus({ state: 'starting', serving_model_id: model })
    setProgress('Waiting for inference readiness. Allow up to 120 seconds.')
    const result = await connector.selectModel(model, size, size, signal)
    if (!result.ok) throw new Error('Local Dream rejected model selection')
    const ready = await connector.waitUntilRunning({ signal })
    setStatus(ready); setOnline(true)
    setTiming(`Model ready in ${((Date.now() - started) / 1000).toFixed(1)} seconds`)
    setProgress('Ready to generate')
  })

  const generate = () => run('Generating', async (signal) => {
    const ready = await connector.waitUntilRunning({ timeoutMs: 5000, signal })
    if (!ready.width || !ready.height) throw new Error('Start a model before generating')
    const started = Date.now()
    setRaw(undefined); setPreview(''); setUpscaled(undefined)
    let completed = false
    for await (const event of connector.generate({ prompt: prompt.trim(), negative_prompt: 'blurry, watermark, text', width: ready.width, height: ready.height, steps, cfg: 7, scheduler: 'dpm', seed: 42, output_format: 'raw', show_diffusion_process: false }, signal)) {
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'progress') setProgress(`Step ${event.step} of ${event.total_steps}`)
      if (event.type === 'complete') {
        if (event.format !== 'raw') throw new Error('Expected raw RGB output for the upscale workflow')
        const image = { image: event.image, width: event.width, height: event.height }
        setPreview(rawRgbPreview(image)); setRaw(image); completed = true
        setTiming(`Generated ${event.width} × ${event.height} in ${((Date.now() - started) / 1000).toFixed(1)} seconds`)
        setProgress('Generation complete')
      }
    }
    if (!completed) throw new Error('Generation ended without an image')
  })

  const upscale = () => run('Upscaling', async (signal) => {
    if (!raw) throw new Error('Generate an image first')
    const selected = catalog?.upscalers.find((item) => item.id === upscaler)
    if (!selected) throw new Error('Select a downloaded upscaler')
    await connector.waitUntilRunning({ timeoutMs: 5000, signal })
    const started = Date.now()
    const result = await connector.upscale({ ...raw, upscalerPath: selected.path }, signal)
    setUpscaled({ ...result, image: `data:image/jpeg;base64,${result.image}` })
    setTiming(`Upscaled ${result.width} × ${result.height} in ${((Date.now() - started) / 1000).toFixed(1)} seconds`)
    setProgress('Upscale complete')
  })

  const stop = () => run('Stopping model', async (signal) => {
    const result = await connector.stop(undefined, signal)
    if (!result.ok) throw new Error('Local Dream rejected shutdown')
    for (let attempt = 0; attempt < 40; attempt++) {
      const next = await connector.status(signal)
      setStatus(next)
      if (next.state === 'idle') { setOnline(false); setProgress('Stopped. Model memory released.'); return }
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }
    throw new Error('Shutdown requested; idle status has not been confirmed')
  })

  const close = () => { if (!busy) setOpen(false) }
  return <>
    <LocalDreamCloudPanel />
    <button type="button" onClick={() => setOpen(true)} className="mx-3 mt-2 min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-[15px] text-white" aria-label="Open Local Dream controls">Local Dream · start, create, upscale, stop</button>
    <BottomSheet open={open} onClose={close} title="Local Dream">
      <div className="flex flex-col gap-4 pb-5 text-[15px] text-white">
        <p role="status" aria-live="polite">{busy || (online ? 'Online · ready' : status?.state === 'idle' ? 'Offline · model stopped' : status?.state === 'running' ? 'Loading · inference not ready' : status?.state || 'Checking connection')}{status?.serving_model_id ? ` · ${status.serving_model_id}` : ''}</p>
        <label className="flex flex-col gap-1">Downloaded model<select aria-label="Local Dream model" value={model} disabled={Boolean(busy)} onChange={(event) => setModel(event.target.value)} className="min-h-11 rounded-xl bg-[#24242c] p-2 text-[16px]">{catalog?.models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="flex gap-2"><button type="button" className={buttonClass} disabled={Boolean(busy) || !model} onClick={() => { void start() }}>Start model</button><button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => { void stop() }}>Stop model</button></div>
        <label className="flex flex-col gap-1">Prompt<textarea aria-label="Local Dream prompt" value={prompt} disabled={Boolean(busy)} onChange={(event) => setPrompt(event.target.value)} rows={3} className="rounded-xl bg-[#24242c] p-3 text-[16px]" /></label>
        <label className="flex items-center gap-3">Steps<input aria-label="Local Dream steps" type="number" min={1} max={50} value={steps} disabled={Boolean(busy)} onChange={(event) => setSteps(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} className="min-h-11 w-24 rounded-xl bg-[#24242c] p-2 text-[16px]" /></label>
        <button type="button" className={buttonClass} disabled={Boolean(busy) || !online || !prompt.trim()} onClick={() => { void generate() }}>Generate locally</button>
        {preview && <figure><img src={preview} alt="Local Dream generated image" className="w-full rounded-xl" /><figcaption>{raw?.width} × {raw?.height}</figcaption><ArtifactActions artifact={{ id: 'localdream-generated', kind: 'image', url: preview, mimeType: 'image/png', format: 'png', width: raw?.width, height: raw?.height, sourceTool: 'localdream.generate' }} /></figure>}
        <label className="flex flex-col gap-1">Downloaded upscaler<select aria-label="Local Dream upscaler" value={upscaler} disabled={Boolean(busy)} onChange={(event) => setUpscaler(event.target.value)} className="min-h-11 rounded-xl bg-[#24242c] p-2 text-[16px]">{catalog?.upscalers.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label>
        <button type="button" className={buttonClass} disabled={Boolean(busy) || !online || !raw || !upscaler} onClick={() => { void upscale() }}>Upscale 4×</button>
        {upscaled && <figure><img src={upscaled.image} alt="Local Dream upscaled image" className="w-full rounded-xl" /><figcaption>{upscaled.width} × {upscaled.height}</figcaption><ArtifactActions artifact={{ id: 'localdream-upscaled', kind: 'image', url: upscaled.image, mimeType: 'image/jpeg', format: 'jpeg', width: upscaled.width, height: upscaled.height, sourceTool: 'localdream.upscale' }} /></figure>}
        <p aria-live="polite">{progress}</p><p>{timing}</p>
        {error && <p role="alert" className="break-words text-rose-300">{error}</p>}
        {busy && <button type="button" className={buttonClass} onClick={() => operation.current?.abort()}>Cancel request</button>}
        <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={close}>Close</button>
      </div>
    </BottomSheet>
  </>
}
