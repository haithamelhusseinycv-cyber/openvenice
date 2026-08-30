import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useImageEdit, useImageMultiEdit, useImageUpscale, useBackgroundRemove } from '../../hooks/use-image-tools'
import { useBlobUrl } from '../../hooks/use-blob-url'
import { Select } from '../ui/select'
import { Label, TextArea, PrimaryButton, ErrorText, EmptyState } from '../ui/shared'
import { cn } from '../../lib/utils'
import { toast } from '../../stores/toast-store'
import { buildSwapPrompt, UNDRESS_PROMPT, type SwapKind, type SwapPerson } from '../../lib/tool-prompts'
import { prepareImage, formatBytes, type PreparedImage } from '../../lib/image-input'
import { useModels } from '../../hooks/use-models'
import { formatVeniceError } from '../../lib/venice-client'

type Tool = 'edit' | 'swap' | 'undress' | 'upscale' | 'remove-bg'

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

function FitImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn('w-full h-auto max-w-full object-contain rounded-lg border border-white/[0.08]', className)}
      style={{ maxHeight: 'min(52dvh, 720px)', touchAction: 'pinch-zoom' }}
    />
  )
}

export function ImageTools() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: availableEditModels } = useModels('inpaint')
  const editModelOptions = availableEditModels?.map((m) => ({ value: m.id, label: m.model_spec?.name || m.id })) ?? []
  const [pending] = useState(() => useImageWorkspace.getState().pendingSource)
  const [tool, setTool] = useState<Tool>(pending?.tool ?? 'edit')
  const [imageData, setImageData] = useState<string | null>(pending?.data ?? null)
  const [imageName, setImageName] = useState(pending?.name ?? '')
  useEffect(() => {
    if (pending) useImageWorkspace.getState().clearPendingSource()
  }, [pending])
  const [idImage, setIdImage] = useState<string | null>(null)
  const [idName, setIdName] = useState('')
  const [secondIdImage, setSecondIdImage] = useState<string | null>(null)
  const [secondIdName, setSecondIdName] = useState('')
  const [dualSwap, setDualSwap] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [resultUrl, setResultBlob, resetResult] = useBlobUrl()
  const fileRef = useRef<HTMLInputElement>(null)
  const idFileRef = useRef<HTMLInputElement>(null)
  const secondIdFileRef = useRef<HTMLInputElement>(null)
  const [sceneSize, setSceneSize] = useState('auto')

  const [editPrompt, setEditPrompt] = useState(() =>
    loadSaved('venice-edit-prompt', '')
  )
  const [editModel, setEditModel] = useState('qwen-edit-uncensored')

  useEffect(() => {
    try {
      localStorage.setItem('venice-edit-prompt', editPrompt)
    } catch {
      // Ignore quota / private-mode storage errors
    }
  }, [editPrompt])

  const [swapKind, setSwapKind] = useState<SwapKind>('face')
  const [secondSwapKind, setSecondSwapKind] = useState<SwapKind>('face')
  const [swapPerson, setSwapPerson] = useState<SwapPerson>('woman')
  const [scale] = useState(2)
  const [enhance] = useState(false)
  const [enhanceCreativity] = useState(0.5)
  const [enhancePrompt] = useState('')

  const editMutation = useImageEdit()
  const swapMutation = useImageMultiEdit()
  const undressMutation = useImageEdit()
  const upscaleMutation = useImageUpscale()
  const bgRemoveMutation = useBackgroundRemove()

  const readFile = async (file: File, slot: string, onDone: (data: string, name: string) => void) => {
    setUploadError(null)
    try {
      const prepared: PreparedImage = await prepareImage(file)
      setUploadInfo((s) => ({
        ...s,
        [slot]: `${prepared.format} · ${prepared.width}×${prepared.height} · ${formatBytes(prepared.preparedBytes)}${prepared.preparedBytes < prepared.originalBytes ? ` (from ${formatBytes(prepared.originalBytes)})` : ''}`,
      }))
      onDone(prepared.dataUrl, prepared.name)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not read this image.')
    }
  }

  const dualSwapPrompt = (maleKind: SwapKind, femaleKind: SwapKind) =>
    `Reference 1 is the target scene and composition. Reference 2 maps only to the male subject and requires a ${maleKind} swap. Reference 3 maps only to the female subject and requires a ${femaleKind} swap. Preserve the target pose, framing, camera angle, lighting, background, interaction and all non-identity details. Keep both identities separate; never blend, exchange or cross-map them.`

  const aspectRatio = sceneSize || 'auto'

  const handleProcess = () => {
    resetResult()
    const opts = {
      onSuccess: (blob: Blob) => setResultBlob(blob),
      onError: (err: unknown) => toast.fromError(err, 'Image tool failed'),
    }
    if (tool === 'edit') {
      if (!imageData) return
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
    } else if (tool === 'swap') {
      if (!imageData || !idImage) return
      swapMutation.mutate(
        {
          images: dualSwap && secondIdImage ? [imageData, idImage, secondIdImage] : [imageData, idImage],
          prompt: dualSwap ? dualSwapPrompt(swapKind, secondSwapKind) : buildSwapPrompt(swapKind, swapPerson),
          modelId: editModel,
          aspect_ratio: aspectRatio,
          safe_mode: false,
          enhance_prompt: false,
          disable_prompt_optimization_thinking: true,
        },
        opts,
      )
    } else if (tool === 'undress') {
      if (!imageData) return
      undressMutation.mutate(
        {
          images: [imageData],
          prompt: UNDRESS_PROMPT,
          modelId: editModel,
          aspect_ratio: aspectRatio,
          safe_mode: false,
          enhance_prompt: false,
          disable_prompt_optimization_thinking: true,
        },
        opts,
      )
    } else if (tool === 'upscale') {
      if (!imageData) return
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
    } else if (imageData) {
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
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `venice-${tool}-result.png`
    a.click()
  }

  const swapReady = !!(imageData && idImage && (!dualSwap || secondIdImage) && apiKey && !isLoading)
  const otherReady = !!(imageData && apiKey && !isLoading && (tool !== 'edit' || editPrompt.trim()))

  const removeSource = () => {
    setImageData(null)
    setImageName('')
    resetResult()
    clearFileInput(fileRef.current)
  }

  const removeId = () => {
    setIdImage(null)
    setIdName('')
    resetResult()
    clearFileInput(idFileRef.current)
  }

  const removeSecondId = () => {
    setSecondIdImage(null)
    setSecondIdName('')
    resetResult()
    clearFileInput(secondIdFileRef.current)
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-white/[0.06] p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto shrink-0 max-h-[48vh] md:max-h-none">
        <div className="flex flex-wrap gap-1 bg-white/[0.02] rounded-lg p-1 border border-white/[0.06]">
          {([['edit', 'Edit'], ['swap', 'Swap'], ['undress', 'Undress'], ['upscale', 'Upscale'], ['remove-bg', 'BG']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTool(id); resetResult() }}
              className={cn(
                'flex-1 min-w-[4.5rem] min-h-11 px-2 py-2 text-[14px] font-medium rounded-md transition-all duration-150',
                tool === id ? 'bg-white text-black' : 'text-white/55 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <Label>{tool === 'swap' ? '1. Target still' : tool === 'undress' ? 'Dressed photo' : 'Source image'}</Label>
          {imageData ? (
            <div className="relative">
              <FitImg src={imageData} alt="Source" />
              <button
                type="button"
                onClick={removeSource}
                aria-label="Remove image"
                className="absolute top-1.5 right-1.5 px-2 min-h-11 bg-black/70 rounded-md text-white text-[14px]"
              >
                Remove
              </button>
              <span className="text-[13px] text-white/45 mt-1 block truncate">{imageName}{uploadInfo.target ? ` · ${uploadInfo.target}` : ''}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24"
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void readFile(file, 'target', (data, name) => { setImageData(data); setImageName(name); resetResult() })
                clearFileInput(e.target)
              }} />
              <p className="text-[15px] text-white/60">
                {tool === 'undress' ? 'Upload a dressed adult photo' : tool === 'swap' ? 'Lustify still / body photo' : 'Source image'}
              </p>
            </button>
          )}
        </div>

        {tool === 'swap' && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <Label>{dualSwap ? '2. Male identity' : '2. Identity photo'}</Label>
              <button type="button" onClick={() => { setDualSwap(!dualSwap); resetResult() }} className="min-h-11 px-3 rounded-md bg-white/[0.06] text-[13px] text-white/80">
                {dualSwap ? 'Dual-person on' : 'Dual-person off'}
              </button>
            </div>
            {idImage ? (
              <div className="relative">
                <FitImg src={idImage} alt="ID" />
                <button
                  type="button"
                  onClick={removeId}
                  aria-label="Remove ID image"
                  className="absolute top-1.5 right-1.5 px-2 min-h-11 bg-black/70 rounded-md text-white text-[14px]"
                >
                  Remove
                </button>
                <span className="text-[13px] text-white/45 mt-1 block truncate">{idName}{uploadInfo.identity1 ? ` · ${uploadInfo.identity1}` : ''}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => idFileRef.current?.click()}
                className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24"
              >
                <input ref={idFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void readFile(file, 'identity1', (data, name) => { setIdImage(data); setIdName(name); resetResult() })
                  clearFileInput(e.target)
                }} />
                <p className="text-[15px] text-white/60">Front face / head / body ID</p>
              </button>
            )}
          </div>
        )}

        {tool === 'swap' && dualSwap && (
          <div>
            <Label>3. Female identity</Label>
            {secondIdImage ? (
              <div className="relative">
                <FitImg src={secondIdImage} alt="Female identity" />
                <button type="button" onClick={removeSecondId} aria-label="Remove female identity" className="absolute top-1.5 right-1.5 px-2 min-h-11 bg-black/70 rounded-md text-white text-[14px]">Remove</button>
                <span className="text-[13px] text-white/45 mt-1 block truncate">{secondIdName}{uploadInfo.identity2 ? ` · ${uploadInfo.identity2}` : ''}</span>
              </div>
            ) : (
              <button type="button" onClick={() => secondIdFileRef.current?.click()} className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24">
                <input ref={secondIdFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void readFile(file, 'identity2', (data, name) => { setSecondIdImage(data); setSecondIdName(name); resetResult() })
                  clearFileInput(e.target)
                }} />
                <p className="text-[15px] text-white/60">Upload female face / head / body identity</p>
              </button>
            )}
          </div>
        )}

        {tool === 'edit' && (
          <div><Label>Edit prompt</Label><TextArea value={editPrompt} onChange={setEditPrompt} placeholder="Keep identity. Change only what I type…" rows={3} /></div>
        )}

        {(tool === 'edit' || tool === 'swap' || tool === 'undress') && (
          <div>
            <Label>Model</Label>
            <Select value={editModel} onChange={setEditModel} options={editModelOptions} searchable />
          </div>
        )}

        {tool === 'swap' && (
          <>
            {!dualSwap && <div>
              <Label>3. Who to swap</Label>
              <div className="flex gap-1">
                {(['woman', 'man'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSwapPerson(p)}
                    className={cn(
                      'flex-1 min-h-11 py-2 text-[15px] rounded-lg capitalize',
                      swapPerson === p ? 'bg-white text-black' : 'bg-white/[0.06] text-white/70',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>}
            <div>
              <Label>{dualSwap ? '4. Male swap type' : '4. Swap type'}</Label>
              <div className="flex gap-1">
                {(['face', 'head', 'body'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSwapKind(k)}
                    className={cn(
                      'flex-1 min-h-11 py-2 text-[15px] rounded-lg capitalize',
                      swapKind === k ? 'bg-white text-black' : 'bg-white/[0.06] text-white/70',
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {dualSwap && (
              <div>
                <Label>5. Female swap type</Label>
                <div className="flex gap-1">
                  {(['face', 'head', 'body'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSecondSwapKind(k)}
                      className={cn(
                        'flex-1 min-h-11 py-2 text-[15px] rounded-lg capitalize',
                        secondSwapKind === k ? 'bg-white text-black' : 'bg-white/[0.06] text-white/70',
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] leading-relaxed text-white/60" role="status" aria-live="polite">
                  Reference 2 → male {swapKind} · Reference 3 → female {secondSwapKind}
                </div>
              </div>
            )}
          </>
        )}

        {(tool === 'edit' || tool === 'swap' || tool === 'undress') && (
          <div>
            <Label>Output size</Label>
            <div className="flex flex-wrap gap-1">
              {SCENE_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSceneSize(s.value)}
                  className={cn(
                    'px-3 py-2 text-[14px] rounded-md min-h-11',
                    sceneSize === s.value ? 'bg-white text-black' : 'bg-white/[0.06] text-white/65',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <PrimaryButton
          onClick={handleProcess}
          disabled={tool === 'swap' ? !swapReady : !otherReady}
          loading={isLoading}
        >
          {tool === 'edit'
            ? 'Edit Image'
            : tool === 'swap'
              ? dualSwap ? `Swap male ${swapKind} + female ${secondSwapKind}` : `Swap ${swapKind}`
              : tool === 'undress'
                ? 'Undress'
                : tool === 'upscale'
                  ? 'Upscale Image'
                  : 'Remove Background'}
        </PrimaryButton>
        {uploadError && <ErrorText>{uploadError}</ErrorText>}
        {error && (
          <>
            <ErrorText>{formatVeniceError(error)}</ErrorText>
            <button type="button" onClick={handleProcess} disabled={isLoading} className="min-h-11 rounded-lg border border-white/[0.14] px-3 text-[14px] text-white/80">
              Retry with prepared images
            </button>
          </>
        )}
      </div>

      <div className="flex-1 p-3 sm:p-6 overflow-y-auto flex flex-col min-w-0 min-h-0">
        {resultUrl ? (
          <div className="animate-fade-in flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Result</Label>
              <button type="button" onClick={downloadResult} className="min-h-11 px-3 rounded-lg bg-white text-black text-[15px] font-medium">
                Save
              </button>
            </div>
            <FitImg src={resultUrl} alt="Result" className={cn(tool === 'remove-bg' && 'bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#111_0%_50%)_0_0/20px_20px]')} />
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
