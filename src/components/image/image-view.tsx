import { useState, useMemo, useEffect } from 'react'
import type { ImageToolId } from '../../stores/image-workspace-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useModels } from '../../hooks/use-models'
import { useImageGenerate } from '../../hooks/use-image'
import { useAuthStore } from '../../stores/auth-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { DEFAULT_IMAGE_MODEL_ID, isAllowedImageModel } from '../../lib/allowed-models'
import { Label, TextArea, PrimaryButton, PillGroup, ErrorText } from '../ui/shared'
import { GenerationView } from '../ui/generation-view'
import type { ImageConstraints } from '../../types/venice'

const DEFAULT_PROMPT = `amateur iphone snapshot, slightly messy framing, film grain, available room light, one light source, messy lived-in bedroom, unmade bed, clutter, raw candid
2people, 1girl, 1boy, adults 18+, couple having sex, third-person view, both faces visible, woman's face clearly visible, man's face visible
natural skin, visible pores, peach fuzz, skin imperfections, realistic bodies, sweat, flushed, damp hair, half-lidded eyes, parted lips, uncensored nsfw
erect nipples, detailed areolae, wet pussy, labia, trimmed pubic hair
erect penis, hard cock, veiny shaft, testicles, pubic hair
penis inside pussy, labia stretched around the shaft, part of the shaft still visible, insertion readable, anatomically correct penetration`

const DEFAULT_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, plastic skin, waxy skin, doll, airbrushed, beauty filter, studio, cyclorama, rim light, cinematic lighting, posed photoshoot, pov, hidden faces, censored, mosaic, blurry genitals, clothes, lingerie on, flaccid, small penis, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, penis beside pussy, disconnected genitals, bad insertion`

function loadSaved(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    return saved ?? fallback
  } catch {
    return fallback
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
  const defaultSteps = constraints?.steps?.default || 20
  const promptLimit = constraints?.promptCharacterLimit || 4096

  const [prompt, setPrompt] = useState(() =>
    loadSaved('venice-image-prompt', DEFAULT_PROMPT)
  )
  const [negativePrompt, setNegativePrompt] = useState(() =>
    loadSaved('venice-image-negative', DEFAULT_NEGATIVE)
  )
  const [sizeIdx, setSizeIdx] = useState('2')
  const [aspectRatio, setAspectRatio] = useState('')
  const [resolution, setResolution] = useState('')
  const [steps, setSteps] = useState(defaultSteps)
  const [variants, setVariants] = useState(1)
  const [images, setImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const modelResetKey = `${model}:${defaultSteps}`
  const [boundModelKey, setBoundModelKey] = useState(modelResetKey)
  if (boundModelKey !== modelResetKey) {
    setBoundModelKey(modelResetKey)
    setSteps(defaultSteps)
    setAspectRatio('')
    setResolution('')
  }

  useEffect(() => {
    try {
      localStorage.setItem('venice-image-prompt', prompt)
      localStorage.setItem('venice-image-negative', negativePrompt)
    } catch {
      // Ignore quota / private-mode storage errors
    }
  }, [prompt, negativePrompt])
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

  const mutation = useImageGenerate()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    const size = DEFAULT_SIZE_MAP[Number(sizeIdx)]

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
          setImages((prev) => [...newImages, ...prev])
        },
      },
    )
  }

  const controls = (
    <>
      <div>
        <Label hint={`${prompt.length}/${promptLimit}`}>Prompt</Label>
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

      <PrimaryButton onClick={handleGenerate} disabled={!prompt.trim() || !apiKey} loading={mutation.isPending} size="lg">
        {mutation.isPending ? 'Generating…' : 'Generate'}
      </PrimaryButton>
      {mutation.error && <ErrorText>{mutation.error.message}</ErrorText>}
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
