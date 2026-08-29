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
} from '../../lib/defaults'
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
const DEFAULT_SIZE_MAP = [
  { w: 512, h: 512 }, { w: 768, h: 768 }, { w: 1024, h: 1024 }, { w: 1280, h: 1280 },
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
  const [aspectRatio, setAspectRatio] = useState(() => loadSaved('venice-image-aspect', ''))
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

  const aspectOptions = useMemo(() => {
    if (!hasAspectRatios) return []
    return [
      { value: '', label: 'Auto' },
      ...constraints!.aspectRatios!.map((a) => ({ value: a, label: a })),
    ]
  }, [constraints, hasAspectRatios])

  const resolutionOptions = useMemo(() => {
    if (!hasResolutions) return []
    return constraints!.resolutions!.map((r) => ({ value: r, label: r }))
  }, [constraints, hasResolutions])

  const sendToTool = useImageWorkspace((s) => s.sendToTool)
  const [undressTarget, setUndressTarget] = useState<{ src: string; name: string } | null>(null)

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
    if (!prompt.trim()) return
    const size = DEFAULT_SIZE_MAP[Number(sizeIdx)] || DEFAULT_SIZE_MAP[2]
    const seedNum = seed.trim() === '' ? undefined : Number(seed)
    const validSeed = seedNum !== undefined && Number.isFinite(seedNum) ? Math.trunc(seedNum) : undefined

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

    if (hasAspectRatios && aspectRatio) {
      req.aspect_ratio = aspectRatio
    } else if (!hasAspectRatios) {
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
          <button type="button" onClick={copyPrompt} className="text-[11px] text-white/40 hover:text-white/80">
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
        </div>
        <TextArea value={prompt} onChange={setPrompt} placeholder="Amateur couple sex still…" />
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
        <input type="range" min={1} max={maxSteps} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full" />
      </div>
      <div>
        <Label hint={String(variants)}>Variants</Label>
        <input type="range" min={1} max={2} value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full" />
      </div>
      <div>
        <Label hint={seed.trim() === '' ? 'random' : seed}>Seed</Label>
        <input
          type="text"
          inputMode="numeric"
          value={seed}
          onChange={(e) => setSeed(e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="Leave empty for random"
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[13px] text-white/85 outline-none focus:border-white/[0.2] placeholder:text-white/30"
        />
      </div>

      <PrimaryButton onClick={handleGenerate} disabled={!prompt.trim() || !apiKey} loading={mutation.isPending} size="lg">
        {mutation.isPending ? 'Generating…' : 'Generate'}
      </PrimaryButton>
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => { setImages([]); setSelectedImage(null) }}
          className="text-[13px] text-white/45 hover:text-white/80"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedImage(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={toImageSrc(selectedImage)} alt="Generated" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl" />
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button onClick={() => sendGenerated('edit', selectedImage)} aria-label="Send to Edit" className="px-2 py-2 bg-black/60 hover:bg-black/80 rounded-lg text-[12px] text-white/80 hover:text-white transition-colors backdrop-blur-sm">
                Edit
              </button>
              <button onClick={() => sendGenerated('swap', selectedImage)} aria-label="Send to Swap" className="px-2 py-2 bg-black/60 hover:bg-black/80 rounded-lg text-[12px] text-white/80 hover:text-white transition-colors backdrop-blur-sm">
                Swap
              </button>
              <button onClick={() => setUndressTarget({ src: toImageSrc(selectedImage), name: fileName() })} aria-label="Send to Undress" className="px-2 py-2 bg-black/60 hover:bg-black/80 rounded-lg text-[12px] text-white/80 hover:text-white transition-colors backdrop-blur-sm">
                Undress
              </button>
              <button onClick={() => downloadImage(selectedImage)} aria-label="Download" className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              </button>
              <button onClick={() => setSelectedImage(null)} aria-label="Close" className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {images.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          {mutation.isPending ? (
            <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
              <div className="w-8 h-8 border-2 border-white/[0.08] border-t-[var(--color-accent)] rounded-full animate-spin" />
              <span className="text-[13px] text-white/55">Generating…</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {mutation.isPending && Array.from({ length: variants }).map((_, i) => (
            <div key={`skel-${i}`} className="aspect-square rounded-xl skeleton" />
          ))}
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={toImageSrc(img)}
                alt={`Generated ${i + 1}`}
                className="w-full rounded-xl cursor-pointer border border-white/[0.05] hover:border-white/[0.18] transition-all duration-200"
                onClick={() => setSelectedImage(img)}
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={(e) => { e.stopPropagation(); sendGenerated('edit', img, i) }}
                aria-label="Send to Edit"
                className="px-1.5 py-1 bg-black/60 hover:bg-black/85 rounded-lg text-[11px] text-white/80 hover:text-white backdrop-blur-sm"
                title="Send to Edit"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); sendGenerated('swap', img, i) }}
                aria-label="Send to Swap"
                className="px-1.5 py-1 bg-black/60 hover:bg-black/85 rounded-lg text-[11px] text-white/80 hover:text-white backdrop-blur-sm"
                title="Send to Swap"
              >
                Swap
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setUndressTarget({ src: toImageSrc(img), name: fileName(i) }) }}
                aria-label="Send to Undress"
                className="px-1.5 py-1 bg-black/60 hover:bg-black/85 rounded-lg text-[11px] text-white/80 hover:text-white backdrop-blur-sm"
                title="Send to Undress"
              >
                Undress
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); downloadImage(img, i) }}
                aria-label="Download"
                className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white/70 hover:text-white backdrop-blur-sm"
                title="Download"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              </button>
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
            <div className="text-[15px] font-semibold text-white/90">Adult confirmation</div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Undress is adult-only image editing. Confirm you are 18 or older and that you want to send this generated image to the Undress tool.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setUndressTarget(null)} className="px-3 py-1.5 rounded-lg text-[13px] text-white/50 hover:text-white/80">
                Cancel
              </button>
              <button type="button" onClick={confirmUndress} className="px-3 py-1.5 rounded-lg bg-white text-black text-[13px] font-medium">
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
