import { useState, useRef, useCallback } from 'react'
import { routeIntelligently, enhancePromptForNSFW, type RoutingDecision } from '../../agent/intelligent-router'
import { haptic } from '../../lib/haptics'

interface SmartActionBarProps {
  onRoute: (decision: RoutingDecision, enhancedPrompt: string) => void
  disabled?: boolean
}

export function SmartActionBar({ onRoute, disabled }: SmartActionBarProps) {
  const [prompt, setPrompt] = useState('')
  const [hasImages, setHasImages] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [preview, setPreview] = useState<RoutingDecision | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const analyze = useCallback(() => {
    if (!prompt.trim() && !hasImages) return
    const decision = routeIntelligently({
      prompt: prompt.trim(),
      hasImages,
      imageCount,
    })
    setPreview(decision)
    haptic('select')
  }, [prompt, hasImages, imageCount])

  const submit = useCallback(() => {
    if (!preview) return
    const enhanced = enhancePromptForNSFW(prompt.trim())
    haptic('success')
    onRoute(preview, enhanced)
    setPrompt('')
    setHasImages(false)
    setImageCount(0)
    setPreview(null)
  }, [preview, prompt, onRoute])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    setHasImages(files.length > 0)
    setImageCount(files.length)
  }, [])

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#111114] p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-[14px] font-medium text-white/90">Smart Create</span>
        <span className="ml-auto text-[11px] text-white/40">AI routes automatically</span>
      </div>

      <textarea
        className="min-h-[80px] resize-none rounded-xl bg-[#0a0a0c] p-3 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
        placeholder="Describe what you want to create... (or attach photos)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={disabled}
        maxLength={5000}
      />

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[13px] text-white/70 active:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {imageCount > 0 ? `${imageCount} photo${imageCount > 1 ? 's' : ''}` : 'Photos'}
        </button>

        <button
          type="button"
          onClick={analyze}
          disabled={disabled || (!prompt.trim() && !hasImages)}
          className="min-h-10 flex-1 rounded-xl bg-white/10 px-4 text-[13px] font-medium text-white disabled:opacity-30"
        >
          Analyze
        </button>

        {preview && (
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="min-h-10 flex-1 rounded-xl bg-[var(--color-accent)] px-4 text-[13px] font-semibold text-black disabled:opacity-40"
          >
            Create
          </button>
        )}
      </div>

      {preview && (
        <div className="animate-fade-in rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-3">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md bg-[var(--color-accent)]/20 px-1.5 py-0.5 font-medium text-[var(--color-accent)]">
              {preview.intent.replace(/_/g, ' ')}
            </span>
            <span className="text-white/50">
              {preview.useCloud ? 'Cloud GPU' : 'Local'} · {preview.quality} quality
            </span>
            <span className="ml-auto text-white/30">{Math.round(preview.confidence * 100)}% match</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{preview.reasoning}</p>
        </div>
      )}
    </div>
  )
}
