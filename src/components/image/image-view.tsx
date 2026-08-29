import { useState, useMemo, useEffect } from 'react'
import type { ImageToolId } from '../../stores/image-workspace-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useModels } from '../../hooks/use-models'
import { useImageGenerate } from '../../hooks/use-image'
import { useAuthStore } from '../../stores/auth-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { DEFAULT_IMAGE_MODEL_ID, isAllowedImageModel } from '../../lib/allowed-models'
import {
  LOCKED_IMAGE_SIZE_IDX,
  LOCKED_IMAGE_STEPS,
  LOCKED_IMAGE_VARIANTS,
  loadImageNegative,
  loadImagePrompt,
  pickAspectFromPrompt,
  pickSizeFromPrompt,
} from '../../lib/defaults'
import { scoreImagePrompt } from '../../lib/prompt-gate'
import { formatVeniceError } from '../../lib/venice-client'
import { Label, TextArea, PrimaryButton, PillGroup, ErrorText } from '../ui/shared'
import { GenerationView } from '../ui/generation-view'
import type { ImageConstraints } from '../../types/venice'

const GALLERY_KEY = 'venice-image-gallery'
const GALLERY_MAX = 4

function loadSaved(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    return saved ?? fallback
  } catch {
    return fallback
  }
}

function loadGallery(): string[] {
  try {
    const raw = sessionStorage.getItem(GALLERY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, GALLERY_MAX) : []
  } catch {
    return []
  }
}

function saveGallery(images: string[]) {
  try {
    sessionStorage.setItem(GALLERY_KEY, JSON.stringify(images.slice(0, GALLERY_MAX)))
  } catch {
    try { sessionStorage.removeItem(GALLERY_KEY) } catch { /* ignore */ }
  }
}

function toImageSrc(b64: string): string {
  if (b64.startsWith('data:')) return b64
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`
  if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`
  return `data:image/png;base64,${b64}`
}

const DEFAULT_SIZES = [
  { value: '0', label: '512' },
  { value: '1', label: '768' },
  { value: '2', label: '1024' },
  { value: '3', label: '1280' },
]

export function ImageView() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const selectedModel = useSettingsStore((s) => s.selectedModels.image)
  const { data: models } = useModels('image')
  const allowedImageModels = models?.filter((m) => isAllowedImageModel(m.id))

  const model =
    selectedModel &&
    allowedImageModels?.some((m) => m.id === selectedModel)
      ? selectedModel
      : allowedImageModels?.[0]?.id || DEFAULT_IMAGE_MODEL_ID

  const modelData = models?.find((m) => m.id === model)
  const constraints = modelData?.model_spec?.constraints as ImageConstraints | undefined
  const hasAspectRatios = constraints?.aspectRatios && constraints.aspectRatios.length > 0
  const hasResolutions = constraints?.resolutions && constraints.resolutions.length > 0
  const maxSteps = constraints?.steps?.max || 50
  const defaultSteps = constraints?.steps?.default || LOCKED_IMAGE_STEPS
  const promptLimit = constraints?.promptCharacterLimit || 4096

  const [prompt, setPrompt] = useState(() =>
    loadImagePrompt(loadSaved('venice-image-prompt', ''))
  )
  const [negativePrompt, setNegativePrompt] = useState(() =>
    loadImageNegative(loadSaved('venice-image-negative', ''))
  )
  const [sizeIdx, setSizeIdx] = useState(() => loadSaved('venice-image-size', LOCKED_IMAGE_SIZE_IDX))
  const [aspectRatio, setAspectRatio] = useState(() => pickAspectFromPrompt(loadImagePrompt(loadSaved('venice-image-prompt', ''))))
  const [resolution, setResolution] = useState(() => loadSaved('venice-image-resolution', ''))
  const [steps, setSteps] = useState(() => {
    const saved = loadSaved('venice-image-steps', '')
    const n = Number(saved)
    return Number.isFinite(n) && n > 0 ? n : defaultSteps
  })
  const [seed, setSeed] = useState(() => loadSaved('venice-image-seed', ''))
  const [variants, setVariants] = useState(LOCKED_IMAGE_VARIANTS)
  const [images, setImages] = useState<string[]>(() => loadGallery())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const gate = useMemo(() => scoreImagePrompt(prompt), [prompt])

  useEffect(() => {
    setAspectRatio(pickAspectFromPrompt(prompt))
  }, [prompt])

  useEffect(() => {
    try {
      localStorage.setItem('venice-image-prompt', prompt)
      localStorage.setItem('venice-image-negative', negativePrompt)
      localStorage.setItem('venice-image-size', sizeIdx)
      localStorage.setItem('venice-image-aspect', aspectRatio)
      localStorage.setItem('venice-image-resolution', resolution)
      localStorage.setItem('venice-image-steps', String(steps))
      localStorage.setItem('venice-image-seed', seed)
    } catch {
      // Ignore quota / private-mode storage errors
    }
  }, [prompt, negativePrompt, sizeIdx, aspectRatio, resolution, steps, seed])

  useEffect(() => {
    saveGallery(images)
  }, [images])

  const sendToTool = useImageWorkspace((s) => s.sendToTool)
  const [undressTarget, setUndressTarget] = useState<{ src: string; name: string } | null>(null)

  useEffect(() => {
    const onBack = (e: Event) => {
      if (undressTarget) {
        e.preventDefault()
        setUndressTarget(null)
        return
      }
      if (selectedImage) {
        e.preventDefault()
        setSelectedImage(null)
      }
    }
    window.addEventListener('venice-back', onBack)
    return () => window.removeEventListener('venice-back', onBack)
  }, [selectedImage, undressTarget])

  const aspectOptions = useMemo(() => {
    if (!hasAspectRatios) return []
    return constraints!.aspectRatios!.map((a) => ({ value: a, label: a }))
  }, [constraints, hasAspectRatios])

  const resolutionOptions = useMemo(() => {
    if (!hasResolutions) return []
    return constraints!.resolutions!.map((r) => ({ value: r, label: r }))
  }, [constraints, hasResolutions])

  const fileName = (index?: number) =>
    `generated${index !== undefined ? `-${index + 1}` : ''}.png`

  const sendGenerated = (tool: ImageToolId, b64: string, index?: number) => {
    sendToTool(tool, toImageSrc(b64), fileName(index))
  }

  const confirmUndress = () => {
    if (!undressTarget) return
    sendToTool('undress', undressTarget.src, undressTarget.name)
    setUndressTarget(null)
    setSelectedImage(null)
  }

  const downloadImage = (b64: string, index?: number) => {
    const a = document.createElement('a')
    a.href = toImageSrc(b64)
    a.download = `venice-image${index !== undefined ? `-${index + 1}` : ''}.png`
    a.click()
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const mutation = useImageGenerate()

  const handleGenerate = () => {
    if (!prompt.trim() || !gate.pass) return
    const seedNum = seed.trim() === '' ? undefined : Number(seed)
    const validSeed = seedNum !== undefined && Number.isFinite(seedNum) ? Math.trunc(seedNum) : undefined
    const ratio = pickAspectFromPrompt(prompt)
    const size = pickSizeFromPrompt(prompt)
    setAspectRatio(ratio)

    const req: Record<string, unknown> = {
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      model,
      variants,
      hide_watermark: true,
      safe_mode: false,
      enhance_prompt: false,
      steps,
    }
    if (validSeed !== undefined) req.seed = validSeed

    if (hasAspectRatios) {
      req.aspect_ratio = ratio
    } else {
      req.width = size.w
      req.height = size.h
    }

    if (hasResolutions && resolution) {
      req.resolution = resolution
    }

    mutation.mutate(
      req as unknown as Parameters<typeof mutation.mutate>[0],
      {
        onSuccess: (data) => {
          const newImages = data.images.map((img) => typeof img === 'string' ? img : img.b64_json)
          setImages((prev) => [...newImages, ...prev].slice(0, GALLERY_MAX))
        },
      },
    )
  }

  const controls = (
    <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label hint={`${prompt.length}/${promptLimit}`}>Prompt</Label>
          <button type="button" onClick={copyPrompt} className="text-[13px] text-white/60 hover:text-white min-h-11 px-2">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <TextArea value={prompt} onChange={setPrompt} placeholder="Amateur couple sex still…" rows={5} />
      </div>
      <div><Label>Negative prompt</Label><TextArea value={negativePrompt} onChange={setNegativePrompt} placeholder="blurry, clothes, CGI…" rows={2} /></div>

      {hasAspectRatios ? (
        <div><Label>Aspect Ratio</Label><PillGroup options={aspectOptions} value={aspectRatio} onChange={setAspectRatio} /></div>
      ) : (
        <div><Label>Size</Label><PillGroup options={DEFAULT_SIZES} value={sizeIdx} onChange={setSizeIdx} /></div>
      )}

      {hasResolutions && (
        <div><Label>Resolution</Label><PillGroup options={resolutionOptions} value={resolution || resolutionOptions[0]?.value || ''} onChange={setResolution} /></div>
      )}

      <div>
        <Label hint={String(steps)}>Steps</Label>
        <input type="range" min={1} max={maxSteps} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full min-h-11" />
      </div>
      <div>
        <Label hint={String(variants)}>Variants</Label>
        <input type="range" min={1} max={2} value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full min-h-11" />
      </div>
      <div>
        <Label hint={seed.trim() === '' ? 'random' : seed}>Seed</Label>
        <input
          type="text"
          inputMode="numeric"
          value={seed}
          onChange={(e) => setSeed(e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="Leave empty for random"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2.5 text-[16px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/35 min-h-11"
        />
      </div>

      <div className={`text-[14px] leading-relaxed ${gate.pass ? 'text-white/60' : 'text-red-200'}`}>
        Prompt review {gate.score}% {gate.pass ? '— ready' : `— blocked under 90%. Missing: ${gate.missing.join(', ')}`}
      </div>

      <PrimaryButton onClick={handleGenerate} disabled={!prompt.trim() || !apiKey || !gate.pass} loading={mutation.isPending} size="lg">
        {mutation.isPending ? 'Generating…' : gate.pass ? 'Generate' : 'Blocked under 90%'}
      </PrimaryButton>
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => { setImages([]); setSelectedImage(null) }}
          className="text-[14px] text-white/60 hover:text-white min-h-11"
        >
          Clear gallery
        </button>
      )}
      {mutation.error && <ErrorText>{formatVeniceError(mutation.error)}</ErrorText>}
    </>
  )

  const output = (
    <>
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-fade-in" onClick={() => setSelectedImage(null)}>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
            <img src={toImageSrc(selectedImage)} alt="Generated" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => sendGenerated('edit', selectedImage)} className="min-h-12 rounded-lg bg-white text-black text-[15px] font-medium">Edit</button>
            <button type="button" onClick={() => sendGenerated('swap', selectedImage)} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium">Swap</button>
            <button type="button" onClick={() => setUndressTarget({ src: toImageSrc(selectedImage), name: fileName() })} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium">Undress</button>
            <button type="button" onClick={() => downloadImage(selectedImage)} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium">Save</button>
            <button type="button" onClick={() => setSelectedImage(null)} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium col-span-2 sm:col-span-1">Close</button>
          </div>
        </div>
      )}
      {images.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[30vh]">
          {mutation.isPending ? (
            <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
              <div className="w-8 h-8 border-2 border-white/[0.08] border-t-[var(--color-accent)] rounded-full animate-spin" />
              <span className="text-[15px] text-white/60">Generating…</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {mutation.isPending && Array.from({ length: variants }).map((_, i) => (
            <div key={`skel-${i}`} className="aspect-[3/2] rounded-xl skeleton" />
          ))}
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img
                src={toImageSrc(img)}
                alt={`Generated ${i + 1}`}
                className="w-full rounded-xl cursor-pointer border border-white/[0.08]"
                onClick={() => setSelectedImage(img)}
              />
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                <button type="button" onClick={() => sendGenerated('edit', img, i)} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium">Edit</button>
                <button type="button" onClick={() => sendGenerated('swap', img, i)} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium">Swap</button>
                <button type="button" onClick={() => setUndressTarget({ src: toImageSrc(img), name: fileName(i) })} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium">Undress</button>
                <button type="button" onClick={() => downloadImage(img, i)} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium">Save</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {undressTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={() => setUndressTarget(null)}>
          <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#121214] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[17px] font-semibold text-white">Adult confirmation</div>
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">
              Undress is adult-only image editing. Confirm you are 18 or older and that you want to send this generated image to the Undress tool.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setUndressTarget(null)} className="min-h-11 px-3 rounded-lg text-[15px] text-white/70">
                Cancel
              </button>
              <button type="button" onClick={confirmUndress} className="min-h-11 px-3 rounded-lg bg-white text-black text-[15px] font-medium">
                I am 18+ / send to Undress
              </button>
            </div>
          </div>
        </div>
      )}
      <GenerationView controls={controls} output={output} />
    </>
  )
}
