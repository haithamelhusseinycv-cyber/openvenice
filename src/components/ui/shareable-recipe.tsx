import { shareUrl } from '../../lib/share-url'
import { useState, useEffect, useMemo } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface Recipe {
  prompt: string
  negative?: string
  model?: string
  steps?: number
  seed?: number
  aspectRatio?: string
  preset?: string
}

function toBase64Url(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const safe = padded.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(safe), value => value.charCodeAt(0)))
}

export function encodeRecipe(recipe: Recipe): string {
  try {
    const json = JSON.stringify(recipe)
    return toBase64Url(json)
  } catch {
    return ''
  }
}

export function decodeRecipe(encoded: string): Recipe | null {
  try {
    const json = fromBase64Url(encoded)
    const parsed = JSON.parse(json)
    if (typeof parsed.prompt !== 'string') return null
    return parsed as Recipe
  } catch {
    return null
  }
}

function buildShareUrl(recipe: Recipe): string {
  const encoded = encodeRecipe(recipe)
  return shareUrl('recipe', encoded)
}

interface ShareableRecipeProps {
  prompt: string
  negativePrompt?: string
  model?: string
  steps?: number
  seed?: number
  aspectRatio?: string
  preset?: string
}

export function ShareableRecipe({
  prompt,
  negativePrompt,
  model,
  steps,
  seed,
  aspectRatio,
  preset,
}: ShareableRecipeProps) {
  const [copied, setCopied] = useState(false)
  const [showEncoded, setShowEncoded] = useState(false)

  const recipe = useMemo<Recipe>(() => ({
    prompt,
    negative: negativePrompt || undefined,
    model: model || undefined,
    steps: steps || undefined,
    seed: seed ?? undefined,
    aspectRatio: aspectRatio || undefined,
    preset: preset || undefined,
  }), [prompt, negativePrompt, model, steps, seed, aspectRatio, preset])

  const encoded = useMemo(() => encodeRecipe(recipe), [recipe])
  const shareUrl = useMemo(() => buildShareUrl(recipe), [recipe])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const recipeParam = params.get('recipe')
    if (recipeParam) {
      const decoded = decodeRecipe(recipeParam)
      if (decoded) {
        // Recipe will be available via the URL; parent component can read it
      }
    }
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      haptic('success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      haptic('error')
    }
  }

  const copyEncoded = async () => {
    try {
      await navigator.clipboard.writeText(encoded)
      haptic('success')
    } catch {
      haptic('error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
        Shareable Recipe
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="text-[12px] text-white/50">Share your generation settings as a link</span>
        </div>

        <div className="rounded-lg bg-black/20 p-2 mb-2 overflow-x-auto">
          <code className="text-[11px] text-white/40 break-all">{shareUrl.slice(0, 120)}{shareUrl.length > 120 ? '...' : ''}</code>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              'flex-1 rounded-lg py-2 text-[13px] font-medium min-h-10 transition-colors',
              copied
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white',
            )}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            type="button"
            onClick={() => { haptic('tap'); setShowEncoded(!showEncoded) }}
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] text-white/50 hover:text-white/70 min-h-10"
          >
            {showEncoded ? 'Hide' : 'Raw'}
          </button>
        </div>

        {showEncoded && (
          <div className="mt-2 rounded-lg bg-black/20 p-2 overflow-x-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/25 uppercase tracking-wider">Encoded recipe</span>
              <button
                type="button"
                onClick={copyEncoded}
                className="text-[10px] text-white/40 hover:text-white/60"
              >
                Copy
              </button>
            </div>
            <code className="text-[10px] text-white/30 break-all">{encoded}</code>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <span className="text-[11px] text-white/30 uppercase tracking-wider block mb-1.5">Recipe contents</span>
        <div className="grid grid-cols-2 gap-1.5 text-[12px]">
          <div className="text-white/40">Prompt:</div>
          <div className="text-white/60 truncate">{prompt.slice(0, 30) || '(empty)'}</div>
          {negativePrompt && (
            <>
              <div className="text-white/40">Negative:</div>
              <div className="text-white/60 truncate">{negativePrompt.slice(0, 30)}</div>
            </>
          )}
          {model && (
            <>
              <div className="text-white/40">Model:</div>
              <div className="text-white/60 truncate">{model}</div>
            </>
          )}
          {steps && (
            <>
              <div className="text-white/40">Steps:</div>
              <div className="text-white/60">{steps}</div>
            </>
          )}
          {seed !== undefined && (
            <>
              <div className="text-white/40">Seed:</div>
              <div className="text-white/60">{seed}</div>
            </>
          )}
          {aspectRatio && (
            <>
              <div className="text-white/40">Aspect:</div>
              <div className="text-white/60">{aspectRatio}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function useRecipeFromUrl() {
  const [recipe] = useState<Recipe | null>(() => {
    const value = new URLSearchParams(window.location.search).get('recipe')
    return value ? decodeRecipe(value) : null
  })
  return recipe
}
