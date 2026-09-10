import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useImageEdit, useImageMultiEdit, useImageUpscale, useBackgroundRemove } from '../../hooks/use-image-tools'
import { useBlobUrl } from '../../hooks/use-blob-url'
import { Select } from '../ui/select'
import { Label, TextArea, PrimaryButton, ErrorText, EmptyState } from '../ui/shared'
import { TaskProgress } from '../ui/task-progress'
import { cn } from '../../lib/utils'
import { toast } from '../../stores/toast-store'
import { buildDualSwapPrompt, buildSwapPrompt, buildUndressPrompt, type SwapKind, type SwapPerson } from '../../lib/tool-prompts'
import { prepareImage, formatBytes, type ImagePreparationStage, type PreparedImage } from '../../lib/image-input'
import { useModels } from '../../hooks/use-models'
import { formatVeniceError } from '../../lib/venice-client'
import { DEFAULT_EDIT_MODEL_ID } from '../../lib/allowed-models'

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
      style={{ maxHeight: 'min(70dvh, 720px)', touchAction: 'pinch-zoom' }}
    />
  )
}

export function ImageTools() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const { data: availableEditModels, isLoading: modelsLoading, error: modelsError } = useModels('inpaint')
  const editModelOptions = useMemo(
    () => availableEditModels?.map((m) => ({ value: m.id, label: m.model_spec?.name || m.id })) ?? [],
    [availableEditModels],
  )
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
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparationStatus, setPreparationStatus] = useState('')
  const [preparationPercent, setPreparationPercent] = useState(0)
  const preparationAbortRef = useRef<AbortController | null>(null)
  const [resultUrl, setResultBlob, resetResult] = useBlobUrl()
  const fileRef = useRef<HTMLInputElement>(null)
  const idFileRef = useRef<HTMLInputElement>(null)
  const secondIdFileRef = useRef<HTMLInputElement>(null)
  const [sceneSize, setSceneSize] = useState('auto')

  const [editPrompt, setEditPrompt] = useState(() =>
    loadSaved('venice-edit-prompt', '')
  )
  const [preferredEditModel, setPreferredEditModel] = useState(DEFAULT_EDIT_MODEL_ID)
  const editModel = editModelOptions.some((option) => option.value === preferredEditModel)
    ? preferredEditModel
    : editModelOptions[0]?.value || preferredEditModel

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
  const [scale] = useState<2 | 4>(2)

  useEffect(() => () => preparationAbortRef.current?.abort(), [])

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

  const resetResult = () => {
    resetResultBlob()
  }

  const resetResultBlob = useBlobUrl()[1]

  const handleProcess = () => {
    resetResult()
    resetMutations()
    const opts = {
      onSuccess: (blob: Blob) => setResultBlob(blob),
      onError: (err: unknown) => toast.fromError(err, 'Image tool failed'),
    }
    if (tool === 'edit') {
      if (!imageData) return
      editMutation.mutate(
        {
          images: [imageData],
          prompt: editPrompt || 'Keep identity. Change only what the user typed.',
          modelId: editModel,
          aspect_ratio: sceneSize,
          safe_mode: false,
          enhance_prompt: false,
          disable_prompt_optimization_thinking: true,
        },
        opts,
      )
    } else if (tool === 'swap') {
      if (!imageData || !idImage) return
      swapMutation.mutate(
        {
          images: dualSwap && secondIdImage ? [imageData, idImage, secondIdImage] : [imageData, idImage],
          prompt: dualSwap ? buildDualSwapPrompt(swapKind, secondSwapKind) : buildSwapPrompt(swapKind, swapPerson),
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
          prompt: buildUndressPrompt(swapPerson),
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
          creativity: 0.01,
        },
        opts,
      )
    } else if (imageData) {
      bgRemoveMutation.mutate(imageData, opts)
    }
  }

  const aspectRatio = sceneSize || 'auto'

  const handleProcessOriginal = handleProcess
  void handleProcessOriginal

  const isBusy = isPreparing || editMutation.isPending || swapMutation.isPending || undressMutation.isPending || upscaleMutation.isPending || bgRemoveMutation.isPending
  const isLoading = isBusy
  const swapReady = Boolean(imageData && (idImage || (dualSwap && idImage && secondIdImage)))
  const otherReady = Boolean(imageData)

  const uploads = (
    <>
      <div className="flex flex-col gap-2">
        <Label>1. Source image</Label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPreparing}
          className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24 disabled:opacity-45"
        >
          {imageData ? (
            <img src={imageData} alt="Source" className="mx-auto max-h-44 rounded-lg object-contain" />
          ) : (
            <p className="text-[15px] text-white/60">Tap to choose a photo</p>
          )}
        </button>
        {imageData && imageName && (
          <p className="text-[12px] text-white/50 break-words [overflow-wrap:anywhere]">{imageName}{uploadInfo.prepared ? ` · ${formatBytes(uploadInfo.preparedSize ?? 0)}` : ''}</p>
        )}
      </div>
      {tool === 'swap' && (
        <div className="flex flex-col gap-2">
          <Label>2. Identity photo</Label>
          <button
            type="button"
            onClick={() => idFileRef.current?.click()}
            disabled={isPreparing}
            className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24 disabled:opacity-45"
          >
            {idImage ? (
              <img src={idImage} alt="Identity" className="mx-auto max-h-44 rounded-lg object-contain" />
            ) : (
              <p className="text-[15px] text-white/60">Tap to choose identity photo</p>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void prepareImage(file, 'source', (data, name) => { setImageData(data); setImageName(name); resetResult() }, setUploadInfo, setUploadError, setIsPreparing, setPreparationStatus, setPreparationPercent, preparationAbortRef)
              clearFileInput(e.target)
            }}
          />
          <input
            ref={idFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void prepareImage(file, 'identity', (data, name) => { setIdImage(data); setIdName(name); resetResult() }, setUploadInfo, setUploadError, setIsPreparing, setPreparationStatus, setPreparationPercent, preparationAbortRef)
              clearFileInput(e.target)
            }}
          />
          {dualSwap && (
            <button
              type="button"
              onClick={() => secondIdFileRef.current?.click()}
              disabled={isPreparing}
              className="w-full border border-dashed border-white/[0.14] hover:border-white/[0.28] rounded-lg py-8 text-center min-h-24 disabled:opacity-45"
            >
              {secondIdImage ? (
                <img src={secondIdImage} alt="Identity 2" className="mx-auto max-h-44 rounded-lg object-contain" />
              ) : (
                <p className="text-[15px] text-white/60">Upload female face / head / body identity</p>
              )}
            </button>
          )}
          <input
            ref={secondIdFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void prepareImage(file, 'identity2', (data, name) => { setSecondIdImage(data); setSecondIdName(name); resetResult() })
              clearFileInput(e.target)
            }}
          />
        </div>
      )}

      {tool === 'edit' && (
        <div><Label>Edit prompt</Label><TextArea value={editPrompt} onChange={setEditPrompt} placeholder="Keep identity. Change only what I type…" rows={3} /></div>
      )}

      {(tool === 'edit' || tool === 'swap' || tool === 'undress') && (
        <div>
          <Label>Model</Label>
          <Select value={editModel} onChange={setPreferredEditModel} options={editModelOptions} searchable />
          {modelsLoading && <div className="mt-2 text-[13px] text-white/45" role="status">Loading compatible edit models…</div>}
          {modelsError && <ErrorText>{formatVeniceError(modelsError)}</ErrorText>}
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
      {isPreparing && (
        <div className="flex items-center gap-2">
          <TaskProgress className="min-w-0 flex-1" label="Optimizing upload" detail={preparationStatus || 'Starting'} value={preparationPercent} />
          <button type="button" onClick={() => preparationAbortRef.current?.abort()} className="shrink-0 px-2 py-2 text-[12px] text-white/80">
            Cancel
          </button>
        </div>
      )}
      {isLoading && (
        <TaskProgress
          label={tool === 'upscale' ? 'Upscaling image' : tool === 'remove-bg' ? 'Removing background' : `Processing ${tool}`}
          detail="Venice is processing the compressed working copy"
          indeterminate
          showElapsed
        />
      )}
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
  )

  return (
    <div className="flex max-w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
      <div className="max-w-full min-w-0 flex-1 px-3 pb-3 sm:px-6 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-7 lg:pb-6">
        <div className="mb-3 flex flex-wrap gap-1">
          {(['edit', 'swap', 'undress', 'upscale', 'remove-bg'] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              className={cn(
                'min-h-11 rounded-lg px-3 text-[13px] font-medium capitalize transition-colors',
                tool === t ? 'bg-white text-black' : 'bg-white/[0.06] text-white/65 hover:text-white',
              )}
            >
              {t === 'remove-bg' ? 'Remove BG' : t}
            </button>
          ))}
        </div>
        {uploads}
      </div>

      <div className="flex max-w-full min-h-[30vh] min-w-0 flex-1 flex-col overflow-x-hidden p-3 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:touch-pan-y">
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
