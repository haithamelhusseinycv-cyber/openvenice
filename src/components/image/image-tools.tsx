import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useImageEdit, useImageMultiEdit, useImageUpscale, useBackgroundRemove } from '../../hooks/use-image-tools'
import { useBlobUrl } from '../../hooks/use-blob-url'
import {
  ALLOWED_INPAINT_MODEL_IDS,
  DEFAULT_INPAINT_MODEL_ID,
  INPAINT_MODEL_LABELS,
} from '../../lib/allowed-models'
import {
  extensionForBlob,
  ImageInputError,
  validateImageDataUrl,
  validateImageFile,
} from '../../lib/image-io'
import { Select } from '../ui/select'
import { Label, TextArea, PrimaryButton, ErrorText, EmptyState } from '../ui/shared'
import { cn } from '../../lib/utils'
import { toast } from '../../stores/toast-store'

type Tool = 'edit' | 'swap' | 'undress' | 'upscale' | 'remove-bg'
type SwapKind = 'face' | 'head' | 'body'
type SwapPerson = 'woman' | 'man'
type ImageExtension = 'png' | 'jpg' | 'webp'

const EDIT_MODELS = ALLOWED_INPAINT_MODEL_IDS.map((value) => ({
  value,
  label: INPAINT_MODEL_LABELS[value],
}))

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

const SCENE_SIZES = [
  { value: 'auto', label: 'Scene' },
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:4', label: '3:4' },
  { value: '4:5', label: '4:5' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
  { value: '21:9', label: '21:9' },
]

const SWAP_NEGATIVE =
  'different face, similar face, cousin face, beautified face, face mix, identity drift, age change, gender change, extra person, extra limbs, extra fingers, warped hands, melted blend, halo, mismatch lighting, plastic skin, airbrush, cartoon, anime, CGI, text, watermark, mosaic, censor bar, clothes change, pose change, background change, camera change'

function buildSwapPrompt(kind: SwapKind, person: SwapPerson) {
  const subject = person === 'man' ? 'man' : 'woman'
  const bodyParts = person === 'man'
    ? 'torso, chest, belly, hips, legs, arms, skin'
    : 'torso, breasts, belly, hips, legs, arms, skin'

  if (kind === 'face') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nReplace ONLY the face of the ${subject} in image 1 with a 100% 1:1 identical copy of the face from image 2. Copy the exact identity: bone structure, eye shape and color, eyelids, eyebrows, nose, lips, teeth if visible, skin texture, pores, moles, freckles, scars, wrinkles, age, and ethnicity. Do not invent a new face. Do not beautify. Do not slim or age-shift.\n\nKeep image 1 otherwise identical: pose, body, hands, hair, neck, ears, clothing, jewelry, background, lighting, shadows, camera angle, crop, and any visible anatomy. Seamless photoreal blend only at the jawline and ears. Same expression as image 1.\n\nAvoid: ${SWAP_NEGATIVE}`
  }

  if (kind === 'head') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nReplace the entire head of the ${subject} in image 1 with a 100% 1:1 identical copy of the head from image 2, including face, hair, ears, and neck. Copy the exact identity and hairstyle from image 2. Do not invent a new head. Do not beautify.\n\nKeep image 1 body, pose, hands, clothing, jewelry, background, lighting, shadows, camera angle, and crop identical. Match skin tone and shadows only at the neck seam. Photoreal blend.\n\nAvoid: ${SWAP_NEGATIVE}, different hair, hair from image 1`
  }

  return `Image 1 is the target photograph. Image 2 is the body source.\n\nReplace the body of the ${subject} in image 1 with a 100% 1:1 identical copy of the body from image 2, including ${bodyParts}, and any visible anatomy or clothing from image 2. Do not invent a new body. Do not reshape.\n\nKeep the exact face and hair of image 1 100% unchanged. Keep image 1 pose, camera angle, bed or background, and lighting as close as possible. Photoreal blend only at the neck and shoulders.\n\nAvoid: ${SWAP_NEGATIVE}, different face from image 1, face from image 2, new pose`
}

const UNDRESS_NEGATIVE =
  'child, teen, underage, clothes remaining, shirt, bra, panties, lingerie, towel, sheet covering, mosaic, censor bar, black bar, blur over genitals, different face, different hair, different pose, different background, beauty filter, plastic skin, doll, airbrush, cartoon, anime, CGI, male body, extra limbs, extra breasts, extra fingers, warped hands, text, watermark'

const UNDRESS_PROMPT = `UNDRESS. This is an adult woman, 18+.\n\nRemove every piece of clothing from the woman in this photo. Leave her fully naked and uncensored.\n\nKeep a 100% 1:1 identical copy of her face, identity, age, hair, expression, pose, hands, camera angle, crop, lighting, shadows, and background.\n\nBuild the most photoreal naked body that fits THIS woman: match the face age, neck, visible skin tone, weight class, height proportions, and how the clothes currently fit (tight vs loose, implied bust, waist, hips, belly). Natural skin with pores, peach fuzz, and realistic imperfections. Realistic breasts and genitals matching her body type. No lingerie. No towel.\n\nDo not change who she is. Do not change the scene. Do not add another person.\n\nAvoid: ${UNDRESS_NEGATIVE}`

function loadSaved(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    return saved ?? fallback
  } catch {
    return fallback
  }
}

function clearFileInput(input: HTMLInputElement | null) {
  if (input) input.value = ''
}

export function ImageTools() {
  const apiKey = useAuthStore((state) => state.apiKey)
  const [pending] = useState(() => useImageWorkspace.getState().pendingSource)
  const [tool, setTool] = useState<Tool>(pending?.tool ?? 'edit')
  const [imageData, setImageData] = useState<string | null>(pending?.data ?? null)
  const [imageName, setImageName] = useState(pending?.name ?? '')

  useEffect(() => {
    if (pending) useImageWorkspace.getState().clearPendingSource()
  }, [pending])

  const [idImage, setIdImage] = useState<string | null>(null)
  const [idName, setIdName] = useState('')
  const [resultUrl, setResultBlob, resetResult] = useBlobUrl()
  const [resultExtension, setResultExtension] = useState<ImageExtension>('png')
  const fileRef = useRef<HTMLInputElement>(null)
  const idFileRef = useRef<HTMLInputElement>(null)
  const [sceneSize, setSceneSize] = useState('auto')

  const [editPrompt, setEditPrompt] = useState(() => loadSaved('venice-edit-prompt', ''))
  const [editModel, setEditModel] = useState(DEFAULT_INPAINT_MODEL_ID)

  useEffect(() => {
    try {
      localStorage.setItem('venice-edit-prompt', editPrompt)
    } catch {
      // Ignore quota / private-mode storage errors.
    }
  }, [editPrompt])

  const [swapKind, setSwapKind] = useState<SwapKind>('face')
  const [swapPerson, setSwapPerson] = useState<SwapPerson>('woman')
  const [undressConfirmed, setUndressConfirmed] = useState(false)
  const [scale, setScale] = useState(2)
  const [enhance, setEnhance] = useState(false)
  const [enhanceCreativity, setEnhanceCreativity] = useState(0.5)
  const [enhancePrompt, setEnhancePrompt] = useState('')

  const editMutation = useImageEdit()
  const swapMutation = useImageMultiEdit()
  const undressMutation = useImageEdit()
  const upscaleMutation = useImageUpscale()
  const bgRemoveMutation = useBackgroundRemove()

  const resetMutations = () => {
    editMutation.reset()
    swapMutation.reset()
    undressMutation.reset()
    upscaleMutation.reset()
    bgRemoveMutation.reset()
  }

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool)
    setUndressConfirmed(false)
    resetResult()
    resetMutations()
  }

  const readFile = (file: File, onDone: (data: string, name: string) => void) => {
    void validateImageFile(file)
      .then(() => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            toast.error('Could not read that image.')
            return
          }
          onDone(reader.result, file.name)
        }
        reader.onerror = () => toast.error('Could not read that image.')
        reader.readAsDataURL(file)
      })
      .catch((err) => {
        toast.fromError(err instanceof ImageInputError ? err : new Error('Could not read that image.'), 'Invalid image')
      })
  }

  const aspectRatio = sceneSize || 'auto'

  const handleProcess = async () => {
    if (!imageData) return

    try {
      await validateImageDataUrl(imageData)
      if (tool === 'swap') {
        if (!idImage) return
        await validateImageDataUrl(idImage)
      }
    } catch (err) {
      toast.fromError(err, 'Invalid image')
      return
    }

    resetResult()
    resetMutations()
    const opts = {
      onSuccess: (blob: Blob) => {
        setResultExtension(extensionForBlob(blob))
        setResultBlob(blob)
      },
      onError: (err: unknown) => toast.fromError(err, 'Image tool failed'),
    }

    if (tool === 'edit') {
      editMutation.mutate(
        {
          images: [imageData],
          prompt: editPrompt.trim(),
          modelId: editModel,
          aspect_ratio: aspectRatio,
          safe_mode: false,
          enhance_prompt: false,
        },
        opts,
      )
    } else if (tool === 'swap' && idImage) {
      swapMutation.mutate(
        {
          images: [imageData, idImage],
          prompt: buildSwapPrompt(swapKind, swapPerson),
          modelId: DEFAULT_INPAINT_MODEL_ID,
          aspect_ratio: aspectRatio,
          safe_mode: false,
          enhance_prompt: false,
          disable_prompt_optimization_thinking: true,
        },
        opts,
      )
    } else if (tool === 'undress') {
      if (!undressConfirmed) return
      undressMutation.mutate(
        {
          images: [imageData],
          prompt: UNDRESS_PROMPT,
          modelId: DEFAULT_INPAINT_MODEL_ID,
          aspect_ratio: aspectRatio,
          safe_mode: false,
          enhance_prompt: false,
          disable_prompt_optimization_thinking: true,
        },
        opts,
      )
    } else if (tool === 'upscale') {
      upscaleMutation.mutate(
        {
          image: imageData,
          scale,
          enhance,
          enhanceCreativity: enhance ? enhanceCreativity : undefined,
          enhancePrompt: enhance && enhancePrompt.trim() ? enhancePrompt.trim() : undefined,
        },
        opts,
      )
    } else if (tool === 'remove-bg') {
      bgRemoveMutation.mutate(imageData, opts)
    }
  }

  const isLoading =
    editMutation.isPending ||
    swapMutation.isPending ||
    undressMutation.isPending ||
    upscaleMutation.isPending ||
    bgRemoveMutation.isPending

  const error =
    editMutation.error ||
    swapMutation.error ||
    undressMutation.error ||
    upscaleMutation.error ||
    bgRemoveMutation.error

  const downloadResult = () => {
    if (!resultUrl) return
    const anchor = document.createElement('a')
    anchor.href = resultUrl
    anchor.download = `venice-${tool}-result.${resultExtension}`
    anchor.click()
  }

  const swapReady = !!(imageData && idImage && apiKey && !isLoading)
  const otherReady = !!(
    imageData &&
    apiKey &&
    !isLoading &&
    (tool !== 'edit' || editPrompt.trim()) &&
    (tool !== 'undress' || undressConfirmed)
  )

  const removeSource = () => {
    setImageData(null)
    setImageName('')
    setUndressConfirmed(false)
    resetResult()
    resetMutations()
    clearFileInput(fileRef.current)
  }

  const removeId = () => {
    setIdImage(null)
    setIdName('')
    resetResult()
    resetMutations()
    clearFileInput(idFileRef.current)
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-white/[0.06] p-4 md:p-6 flex flex-col gap-4 overflow-y-auto shrink-0 max-h-[58vh] md:max-h-none">
        <div className="flex gap-px bg-white/[0.02] rounded-lg p-0.5 border border-white/[0.04] overflow-x-auto">
          {([['edit', 'Edit'], ['swap', 'Swap'], ['undress', 'Undress'], ['upscale', 'Upscale'], ['remove-bg', 'BG']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => selectTool(id)}
              className={cn(
                'flex-1 min-w-[62px] px-2 py-2.5 text-[12px] font-medium rounded-[7px] transition-all duration-150',
                tool === id ? 'bg-white text-black' : 'text-white/35 hover:text-white/65',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <Label>{tool === 'swap' ? '1. Target still' : tool === 'undress' ? 'Dressed photo' : 'Source image'}</Label>
          {imageData ? (
            <div className="relative group">
              <img src={imageData} alt="Source" className="w-full rounded-lg border border-white/[0.06]" />
              <button
                onClick={removeSource}
                aria-label="Remove image"
                className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-md text-white/60 hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <span className="text-[13px] text-white/30 mt-1 block truncate">{imageName}</span>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg py-8 text-center transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) readFile(file, (data, name) => { setImageData(data); setImageName(name); setUndressConfirmed(false); resetResult() })
                  clearFileInput(e.target)
                }}
              />
              <p className="text-[14px] text-white/50">
                {tool === 'undress' ? 'Upload an adult source photo' : tool === 'swap' ? 'Target still / body photo' : 'Choose source image'}
              </p>
              <p className="mt-1 text-[11px] text-white/25">JPEG, PNG, WebP or GIF · under 25 MB</p>
            </button>
          )}
        </div>

        {tool === 'swap' && (
          <div>
            <Label>2. ID photo</Label>
            {idImage ? (
              <div className="relative group">
                <img src={idImage} alt="ID" className="w-full rounded-lg border border-white/[0.06]" />
                <button onClick={removeId} aria-label="Remove ID image" className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-md text-white/60 hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <span className="text-[13px] text-white/30 mt-1 block truncate">{idName}</span>
              </div>
            ) : (
              <button type="button" onClick={() => idFileRef.current?.click()} className="w-full border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg py-8 text-center transition-colors">
                <input
                  ref={idFileRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) readFile(file, (data, name) => { setIdImage(data); setIdName(name); resetResult() })
                    clearFileInput(e.target)
                  }}
                />
                <p className="text-[14px] text-white/50">Front face / head / body ID</p>
                <p className="mt-1 text-[11px] text-white/25">JPEG, PNG, WebP or GIF · under 25 MB</p>
              </button>
            )}
          </div>
        )}

        {tool === 'edit' && (
          <>
            <div><Label>Edit prompt</Label><TextArea value={editPrompt} onChange={setEditPrompt} placeholder="Describe the requested edit…" rows={3} /></div>
            <div><Label>Model</Label><Select value={editModel} onChange={setEditModel} options={EDIT_MODELS} searchable /></div>
          </>
        )}

        {tool === 'swap' && (
          <>
            <div>
              <Label>3. Who to swap</Label>
              <div className="flex gap-1">
                {(['woman', 'man'] as const).map((person) => (
                  <button key={person} onClick={() => setSwapPerson(person)} className={cn('flex-1 py-2 text-[14px] rounded-lg capitalize', swapPerson === person ? 'bg-white text-black' : 'bg-white/[0.04] text-white/45')}>{person}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>4. Swap type</Label>
              <div className="flex gap-1">
                {(['face', 'head', 'body'] as const).map((kind) => (
                  <button key={kind} onClick={() => setSwapKind(kind)} className={cn('flex-1 py-2 text-[14px] rounded-lg capitalize', swapKind === kind ? 'bg-white text-black' : 'bg-white/[0.04] text-white/45')}>{kind}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {(tool === 'edit' || tool === 'swap' || tool === 'undress') && (
          <div>
            <Label>Output size</Label>
            <div className="flex flex-wrap gap-1">
              {SCENE_SIZES.map((size) => (
                <button key={size.value} onClick={() => setSceneSize(size.value)} className={cn('px-2 py-1.5 text-[12px] rounded-md', sceneSize === size.value ? 'bg-white text-black' : 'bg-white/[0.04] text-white/45')}>{size.label}</button>
              ))}
            </div>
            <p className="text-[12px] text-white/30 leading-relaxed mt-1">Scene follows the uploaded photo ratio. Pick another ratio to change the output crop.</p>
          </div>
        )}

        {tool === 'undress' && (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[12px] text-white/40 leading-relaxed">The instruction is fixed. The action is enabled only after confirming the depicted subject is an adult and you have permission to make this edit.</p>
            <label className="mt-3 flex items-start gap-2 text-[12px] text-white/60 cursor-pointer">
              <input type="checkbox" checked={undressConfirmed} onChange={(e) => setUndressConfirmed(e.target.checked)} className="mt-0.5 accent-white" />
              <span>I confirm the depicted person is an adult and I have the right or permission to make this edit.</span>
            </label>
          </div>
        )}

        {tool === 'swap' && (
          <p className="text-[12px] text-white/30 leading-relaxed">Face copies only the face. Head copies face + hair + neck. Body copies the selected body source while preserving image-1 face and hair.</p>
        )}

        {tool === 'upscale' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1"><Label>Scale</Label><span className="text-[13px] text-white/35 font-mono">{scale}x</span></div>
              <input type="range" min={1} max={4} step={1} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enhance</Label>
              <button onClick={() => setEnhance(!enhance)} aria-pressed={enhance} className={cn('w-8 h-[18px] rounded-full transition-colors relative', enhance ? 'bg-white' : 'bg-white/[0.08]')}>
                <div className={cn('absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all', enhance ? 'left-[16px] bg-black' : 'left-[2px] bg-white/30')} />
              </button>
            </div>
            {enhance && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1"><Label>Creativity</Label><span className="text-[13px] text-white/35 font-mono">{enhanceCreativity.toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={enhanceCreativity} onChange={(e) => setEnhanceCreativity(Number(e.target.value))} className="w-full" />
                </div>
                <div><Label>Enhance prompt</Label><TextArea value={enhancePrompt} onChange={setEnhancePrompt} placeholder="Optional enhancement direction…" rows={2} /></div>
              </>
            )}
          </>
        )}

        <PrimaryButton onClick={() => { void handleProcess() }} disabled={tool === 'swap' ? !swapReady : !otherReady} loading={isLoading}>
          {tool === 'edit'
            ? 'Edit Image'
            : tool === 'swap'
              ? `Swap ${swapKind}`
              : tool === 'undress'
                ? 'Undress'
                : tool === 'upscale'
                  ? 'Upscale Image'
                  : 'Remove Background'}
        </PrimaryButton>
        {error && <ErrorText>{error.message}</ErrorText>}
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col min-w-0 min-h-0">
        {resultUrl ? (
          <div className="animate-fade-in flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Result</Label>
              <button onClick={downloadResult} className="text-[14px] text-white/35 hover:text-white/65 transition-colors flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Download .{resultExtension}
              </button>
            </div>
            <img src={resultUrl} alt="Result" className={cn('w-full rounded-lg border border-white/[0.04]', tool === 'remove-bg' && 'bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#111_0%_50%)_0_0/20px_20px]')} />
          </div>
        ) : (
          <EmptyState>
            {tool === 'edit'
              ? 'Edited image appears here'
              : tool === 'swap'
                ? 'Swapped image appears here'
                : tool === 'undress'
                  ? 'Undressed image appears here'
                  : tool === 'upscale'
                    ? 'Upscaled image appears here'
                    : 'Background-removed image appears here'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
