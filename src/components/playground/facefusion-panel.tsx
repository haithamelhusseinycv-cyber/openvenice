import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultFaceFusionConnector } from '../../connectors/facefusion/default-connector'
import type { FaceFusionModelCatalog } from '../../connectors/facefusion/facefusion-connector'
import { BottomSheet } from '../ui/bottom-sheet'
import { ArtifactActions } from '../chat/artifact-actions'
import { saveGeneratedImage } from '../../lib/image-persistence'

const field = 'min-h-11 rounded-xl bg-[#24242c] p-3 text-[16px]'
const button = 'min-h-11 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40'
export function FaceFusionPanel() {
  const client = useMemo(defaultFaceFusionConnector, [])
  const controller = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<FaceFusionModelCatalog>()
  const [swapper, setSwapper] = useState('')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [mode, setMode] = useState('swap')
  const [enhancer, setEnhancer] = useState('none')
  const [frameEnhancer, setFrameEnhancer] = useState('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [output, setOutput] = useState('')
  const refresh = async () => {
    setError('')
    try {
      const models = await client.listModels()
      setCatalog(models)
      setSwapper(models.swappers.includes(models.selected?.swapper || '') ? models.selected!.swapper! : models.swappers[0] || '')
      setStatus(models.swappers.length + ' swappers · ' + models.faceEnhancers.length + ' face enhancers')
    } catch { setError('Open FaceFusion on this phone to start its Chilli connection, then refresh.') }
  }
  useEffect(() => {
    if (open) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => () => { controller.current?.abort() }, [])
  const photo = (file: File | undefined, slot: 'source' | 'target') => {
    if (!file) { (slot === 'source' ? setSource : setTarget)(''); return }
    if (file.size > 16 * 1024 * 1024) { setError('Choose a photo under 16 MB'); return }
    const reader = new FileReader()
    reader.onload = () => (slot === 'source' ? setSource : setTarget)(String(reader.result))
    reader.onerror = () => setError('Cannot read the photo')
    reader.readAsDataURL(file)
  }
  const run = async () => {
    if (busy) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setError(''); setOutput(''); setStatus('Processing on this phone')
    try {
      const result = mode === 'swap'
        ? await client.swap({ sourceUri: source, targetUri: target, swapper, faceEnhancer: enhancer, frameEnhancer }, abort.signal)
        : await client.enhance({ imageUri: target, faceEnhancer: enhancer, frameEnhancer }, abort.signal)
      await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: result.outputUri, prompt: 'FaceFusion ' + mode, provider: 'facefusion' })
      setOutput(result.outputUri); setStatus('Complete · saved on this device')
    } catch (reason) { setError(abort.signal.aborted ? 'Cancelled' : reason instanceof Error ? reason.message : 'FaceFusion failed') }
    finally { controller.current = null; setBusy(false) }
  }
  return <>
    <button className="mx-3 mt-2 min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-left text-[15px] text-white" onClick={() => setOpen(true)}>FaceFusion · Phone models</button>
    <BottomSheet open={open} onClose={() => setOpen(false)} title="FaceFusion">
      <div className="flex flex-col gap-4 pb-5 text-[15px] text-white">
        <p>Swap faces and restore photos with the installed phone models.</p>
        <p role="status">{status}</p>
        <button className={button} disabled={busy} onClick={() => { void refresh() }}>Refresh models</button>
        <label className="flex flex-col gap-1">Task<select className={field} disabled={busy} value={mode} onChange={event => setMode(event.target.value)}><option value="swap">Face swap</option><option value="enhance">Restore face</option></select></label>
        {mode === 'swap' && <><label className="flex flex-col gap-1">Swapper<select className={field} disabled={busy} value={swapper} onChange={event => setSwapper(event.target.value)}>{catalog?.swappers.map(model => <option key={model}>{model}</option>)}</select></label><label>Source identity<input type="file" accept="image/*" disabled={busy} onChange={event => photo(event.target.files?.[0], 'source')} /></label></>}
        <label>Target photo<input type="file" accept="image/*" disabled={busy} onChange={event => photo(event.target.files?.[0], 'target')} /></label>
        <label className="flex flex-col gap-1">Face restoration<select className={field} disabled={busy} value={enhancer} onChange={event => setEnhancer(event.target.value)}><option value="none">None</option>{catalog?.faceEnhancers.map(model => <option key={model}>{model}</option>)}</select></label>
        <label className="flex flex-col gap-1">Frame enhancement<select className={field} disabled={busy} value={frameEnhancer} onChange={event => setFrameEnhancer(event.target.value)}><option value="none">None</option>{catalog?.frameEnhancers.map(model => <option key={model}>{model}</option>)}</select></label>
        <button className={button} disabled={busy || !catalog || !target || (mode === 'swap' ? !source || !swapper : enhancer === 'none' && frameEnhancer === 'none')} onClick={() => { void run() }}>Run FaceFusion</button>
        {busy && <button className={button} onClick={() => controller.current?.abort()}>Cancel</button>}
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {output && <figure><img src={output} alt="FaceFusion result" className="w-full rounded-xl" /><ArtifactActions artifact={{ id: 'facefusion-result', kind: 'image', url: output, mimeType: 'image/jpeg', format: 'jpeg', sourceTool: 'facefusion.' + mode }} /></figure>}
      </div>
    </BottomSheet>
  </>
}
