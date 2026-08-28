import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { useImageEdit, useImageMultiEdit, useImageUpscale, useBackgroundRemove } from '../../hooks/use-image-tools'
import { useBlobUrl } from '../../hooks/use-blob-url'
import { Select } from '../ui/select'
import { Label, TextArea, PrimaryButton, ErrorText, EmptyState } from '../ui/shared'
import { cn } from '../../lib/utils'
import { toast } from '../../stores/toast-store'

type Tool = 'edit' | 'swap' | 'upscale' | 'remove-bg'
type SwapKind = 'face' | 'head' | 'body'
type SwapPerson = 'woman' | 'man'

const EDIT_MODELS = [
  { value: 'qwen-edit-uncensored', label: 'Qwen Edit Uncensored' },
  { value: 'firered-image-edit', label: 'FireRed Edit' },
]

const SWAP_PROMPTS: Record<SwapKind, string> = {
  face: `Replace only the face of the woman in image 1 with the face identity from image 2. Keep image 1 pose, body, hair, neck, lighting, skin tone, expression blend, clothing, background and genitals unchanged. Seamless photoreal face blend, same camera angle.`,
  head: `Replace the entire head including face, hair and neck of the woman in image 1 with the head from image 2. Keep image 1 body, pose, lighting, clothing, background and genitals unchanged. Match skin tone and shadows at the neck.`,
  body: `Replace the body of the woman in image 1 with the body from image 2. Keep the face and hair of image 1. Keep image 1 pose, bed, lighting and camera. Photoreal blend at neck and shoulders. Do not change the face.`,
}

function loadSaved(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    return saved ?? fallback
  } catch {
    return fallback
  }
}

export function ImageTools() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const [tool, setTool] = useState<Tool>('edit')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [idImage, setIdImage] = useState<string | null>(null)
  const [idName, setIdName] = useState('')
  const [resultUrl, setResultBlob, resetResult] = useBlobUrl()
  const fileRef = useRef<HTMLInputElement>(null)
  const idFileRef = useRef<HTMLInputElement>(null)

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
  const [swapPerson, setSwapPerson] = useState<SwapPerson>('woman')
  const [scale, setScale] = useState(2)
  const [enhance, setEnhance] = useState(false)
  const [enhanceCreativity, setEnhanceCreativity] = useState(0.5)
  const [enhancePrompt, setEnhancePrompt] = useState('')

  const editMutation = useImageEdit()
  const swapMutation = useImageMultiEdit()
  const upscaleMutation = useImageUpscale()
  const bgRemoveMutation = useBackgroundRemove()

  const readFile = (file: File, onDone: (data: string, name: string) => void) => {
    const reader = new FileReader()
    reader.onload = () => onDone(reader.result as string, file.name)
    reader.readAsDataURL(file)
  }

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
          aspect_ratio: 'auto',
          safe_mode: false,
          enhance_prompt: false,
        },
        opts,
      )
    } else if (tool === 'swap') {
      if (!imageData || !idImage) return
      swapMutation.mutate(
        {
          images: [imageData, idImage],
          prompt: SWAP_PROMPTS[swapKind].replace(/woman/g, swapPerson),
          modelId: 'qwen-edit-uncensored',
          safe_mode: false,
          enhance_prompt: false,
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
    editMutation.isPending || swapMutation.isPending || upscaleMutation.isPending || bgRemoveMutation.isPending
  const error = editMutation.error || swapMutation.error || upscaleMutation.error || bgRemoveMutation.error

  const downloadResult = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `venice-${tool}-result.png`
    a.click()
  }

  const swapReady = !!(imageData && idImage && apiKey && !isLoading)
  const otherReady = !!(imageData && apiKey && !isLoading && (tool !== 'edit' || editPrompt.trim()))

  return (
    <div className="flex h-full">
      <div className="w-96 border-r border-white/[0.06] p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
        <div className="flex gap-px bg-white/[0.02] rounded-lg p-0.5 border border-white/[0.04]">
          {([['edit', 'Edit'], ['swap', 'Swap'], ['upscale', 'Upscale'], ['remove-bg', 'BG']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTool(id); resetResult() }}
              className={cn(
                'flex-1 px-1.5 py-2.5 text-[13px] font-medium rounded-[7px] transition-all duration-150',
                tool === id ? 'bg-white text-black' : 'text-white/25 hover:text-white/45',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <Label>{tool === 'swap' ? '1. Target still' : 'Source image'}</Label>
          {imageData ? (
            <div className="relative group">
              <img src={imageData} alt="Source" className="w-full rounded-lg border border-white/[0.06]" />
              <button
                onClick={() => { setImageData(null); setImageName(''); resetResult() }}
                aria-label="Remove image"
                className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-md text-white/60 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <span className="text-[13px] text-white/15 mt-1 block truncate">{imageName}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg py-8 text-center transition-colors"
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                readFile(file, (data, name) => { setImageData(data); setImageName(name); resetResult() })
              }} />
              <p className="text-[14px] text-white/40">Lustify still / body photo</p>
            </button>
          )}
        </div>

        {tool === 'swap' && (
          <div>
            <Label>2. ID photo</Label>
            {idImage ? (
              <div className="relative group">
                <img src={idImage} alt="ID" className="w-full rounded-lg border border-white/[0.06]" />
                <button
                  onClick={() => { setIdImage(null); setIdName(''); resetResult() }}
                  aria-label="Remove ID image"
                  className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-md text-white/60 hover:text-white opacity-0 group-hover:opacity-100"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <span className="text-[13px] text-white/15 mt-1 block truncate">{idName}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => idFileRef.current?.click()}
                className="w-full border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg py-8 text-center transition-colors"
              >
                <input ref={idFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  readFile(file, (data, name) => { setIdImage(data); setIdName(name); resetResult() })
                }} />
                <p className="text-[14px] text-white/40">Front face / head / body ID</p>
              </button>
            )}
          </div>
        )}

        {tool === 'edit' && (
          <>
            <div><Label>Edit prompt</Label><TextArea value={editPrompt} onChange={setEditPrompt} placeholder="Change the background to a sunset beach..." rows={3} /></div>
            <div><Label>Model</Label><Select value={editModel} onChange={setEditModel} options={EDIT_MODELS} searchable /></div>
          </>
        )}

        {tool === 'swap' && (
          <>
            <div>
              <Label>3. Who to swap</Label>
              <div className="flex gap-1">
                {(['woman', 'man'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSwapPerson(p)}
                    className={cn(
                      'flex-1 py-2 text-[14px] rounded-lg capitalize',
                      swapPerson === p ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>4. Swap type</Label>
              <div className="flex gap-1">
                {(['face', 'head', 'body'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSwapKind(k)}
                    className={cn(
                      'flex-1 py-2 text-[14px] rounded-lg capitalize',
                      swapKind === k ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40',
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-white/25 leading-relaxed">
              Face is most accurate. Head next. Body is sloppy. Use a front ID, same-ish light. $0.04 per run.
            </p>
          </>
        )}

        {tool === 'upscale' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Scale</Label>
                <span className="text-[13px] text-white/30 font-mono">{scale}x</span>
              </div>
              <input type="range" min={1} max={4} step={1} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enhance</Label>
              <button
                onClick={() => setEnhance(!enhance)}
                className={cn(
                  'w-8 h-[18px] rounded-full transition-colors relative',
                  enhance ? 'bg-white' : 'bg-white/[0.08]',
                )}
              >
                <div className={cn(
                  'absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all',
                  enhance ? 'left-[16px] bg-black' : 'left-[2px] bg-white/30',
                )} />
              </button>
            </div>
            {enhance && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Creativity</Label>
                    <span className="text-[13px] text-white/30 font-mono">{enhanceCreativity.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={enhanceCreativity} onChange={(e) => setEnhanceCreativity(Number(e.target.value))} className="w-full" />
                </div>
                <div><Label>Enhance prompt</Label><TextArea value={enhancePrompt} onChange={setEnhancePrompt} placeholder="Make it more vibrant..." rows={2} /></div>
              </>
            )}
          </>
        )}

        <PrimaryButton
          onClick={handleProcess}
          disabled={tool === 'swap' ? !swapReady : !otherReady}
          loading={isLoading}
        >
          {tool === 'edit' ? 'Edit Image' : tool === 'swap' ? `Swap ${swapKind}` : tool === 'upscale' ? 'Upscale Image' : 'Remove Background'}
        </PrimaryButton>
        {error && <ErrorText>{error.message}</ErrorText>}
      </div>

      <div className="flex-1 p-6 overflow-y-auto flex flex-col min-w-0">
        {resultUrl ? (
          <div className="animate-fade-in flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Result</Label>
              <button onClick={downloadResult} className="text-[14px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Download
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
                : tool === 'upscale'
                  ? 'Upscaled image appears here'
                  : 'Result appears here'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
