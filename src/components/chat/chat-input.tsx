import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { formatBytes, prepareImage, type ImagePreparationStage } from '../../lib/image-input'
import { TaskProgress } from '../ui/task-progress'

interface ChatInputProps {
  onSend: (message: string, images?: string[]) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  onOpenHistory: () => void
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, onOpenHistory }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparationStatus, setPreparationStatus] = useState('')
  const [preparationPercent, setPreparationPercent] = useState(0)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const preparationAbortRef = useRef<AbortController | null>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])
  useEffect(() => () => preparationAbortRef.current?.abort(), [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isPreparing) return
    onSend(trimmed, images.length > 0 ? images : undefined)
    setValue('')
    setImages([])
  }

  const handleImageUpload = async (files: FileList | File[] | null) => {
    if (!files || isPreparing) return
    setAttachmentError(null)
    setIsPreparing(true)
    const controller = new AbortController()
    preparationAbortRef.current = controller
    try {
      const available = Math.max(0, 4 - images.length)
      const sourceFiles = Array.from(files)
      const selected = sourceFiles.slice(0, available)
      const prepared: string[] = []
      for (const [index, file] of selected.entries()) {
        const label = `${index + 1}/${selected.length} · ${formatBytes(file.size)}`
        const stageLabel: Record<ImagePreparationStage, string> = {
          decoding: 'Decoding',
          resizing: 'Resizing',
          compressing: 'Compressing',
          finalizing: 'Finalizing',
        }
        const stagePercent: Record<ImagePreparationStage, number> = {
          decoding: 12,
          resizing: 35,
          compressing: 68,
          finalizing: 92,
        }
        const result = await prepareImage(file, {
          signal: controller.signal,
          onProgress: (stage) => {
            setPreparationStatus(`${label} · ${stageLabel[stage]}`)
            setPreparationPercent(((index * 100) + stagePercent[stage]) / selected.length)
          },
        })
        prepared.push(result.dataUrl)
        setPreparationPercent(((index + 1) * 100) / selected.length)
      }
      if (prepared.length) setImages((prev) => [...prev, ...prepared].slice(0, 4))
      if (sourceFiles.length > selected.length) setAttachmentError('You can attach up to four images.')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setAttachmentError(error instanceof Error ? error.message : 'Could not prepare this image.')
      }
    } finally {
      setIsPreparing(false)
      setPreparationStatus('')
      setPreparationPercent(0)
      preparationAbortRef.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="max-w-full min-w-0 shrink-0 overflow-x-hidden bg-[#0a0a0c] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-5">
      <div className="mx-auto w-full max-w-[860px] min-w-0">
        {images.length > 0 && (
          <div className="touch-pan-x mb-2 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
            {images.map((img, i) => (
              <div key={i} className="relative group shrink-0">
                <img src={img} alt={`Attachment ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border border-white/[0.08]" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove attachment ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black/85 hover:bg-black border border-white/15 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/50"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'relative max-w-full min-w-0 bg-[#0e0e12] border rounded-2xl overflow-hidden transition-all shadow-lg shadow-black/30',
            'focus-within:border-white/[0.22] focus-within:shadow-xl focus-within:shadow-black/40',
            dragOver ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-white/[0.08]',
          )}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); void handleImageUpload(e.dataTransfer.files) }}
          aria-busy={isPreparing || undefined}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items
              if (!items) return
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  const file = item.getAsFile()
                  if (file) {
                    void handleImageUpload([file])
                  }
                }
              }
            }}
            placeholder={disabled ? 'Connect an API key to start…' : isPreparing ? 'Preparing image…' : dragOver ? 'Drop image to attach' : 'Ask anything — Enter to send, Shift+Enter for newline'}
            rows={2}
            enterKeyHint="send"
            aria-label="Message input"
            className="min-h-[72px] max-h-32 w-full resize-none overflow-y-auto bg-transparent px-4 pb-1 pt-3 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/30 sm:px-5 sm:pt-4"
            disabled={disabled}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleImageUpload(e.target.files) }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || isPreparing || images.length >= 4}
                aria-label="Attach image"
                className="flex items-center gap-1.5 px-2 py-1.5 text-white/50 hover:text-white text-[13px] transition-colors rounded-lg hover:bg-white/[0.05] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                title="Attach image (or drag/paste)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onOpenHistory}
                className="min-h-10 rounded-lg px-2 text-[12px] font-medium text-white/55 hover:bg-white/[0.05] hover:text-white"
              >
                History
              </button>
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white/85 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                <svg width="9" height="9" viewBox="0 0 8 8" fill="currentColor"><rect width="8" height="8" rx="1" /></svg>
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || disabled || isPreparing}
                aria-label="Send message"
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
                  value.trim() && !disabled && !isPreparing
                    ? 'bg-white text-black hover:bg-white/95 active:scale-95 shadow-sm'
                    : 'bg-white/[0.06] text-white/25',
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {isPreparing && (
          <div className="mt-1.5 flex items-center gap-2 px-1">
            <TaskProgress className="min-w-0 flex-1" label="Optimizing upload" detail={preparationStatus || 'Starting'} value={preparationPercent} />
            <button
              type="button"
              onClick={() => preparationAbortRef.current?.abort()}
              className="shrink-0 rounded-md border border-white/[0.12] px-3 py-2 text-[12px] text-white/75"
            >
              Cancel
            </button>
          </div>
        )}
        {attachmentError && <div role="alert" className="mt-1.5 px-1 text-[12px] text-red-300/90">{attachmentError}</div>}
      </div>
    </div>
  )
}
