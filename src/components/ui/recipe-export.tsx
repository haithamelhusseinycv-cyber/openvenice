import { useState, useRef } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface GenerationRecipe {
  prompt: string
  negativePrompt?: string
  model?: string
  steps?: number
  seed?: number
  aspectRatio?: string
  preset?: string
  variants?: number
  exportedAt: string
  version: string
}

function buildRecipe(params: {
  prompt: string
  negativePrompt?: string
  model?: string
  steps?: number
  seed?: number
  aspectRatio?: string
  preset?: string
  variants?: number
}): GenerationRecipe {
  return {
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    model: params.model,
    steps: params.steps,
    seed: params.seed,
    aspectRatio: params.aspectRatio,
    preset: params.preset,
    variants: params.variants,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }
}

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface RecipeExportProps {
  prompt: string
  negativePrompt?: string
  model?: string
  steps?: number
  seed?: number
  aspectRatio?: string
  preset?: string
  variants?: number
}

export function RecipeExport({
  prompt,
  negativePrompt,
  model,
  steps,
  seed,
  aspectRatio,
  preset,
  variants,
}: RecipeExportProps) {
  const [exported, setExported] = useState(false)

  const handleExport = () => {
    haptic('success')
    const recipe = buildRecipe({ prompt, negativePrompt, model, steps, seed, aspectRatio, preset, variants })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadJson(recipe, `chilli-recipe-${timestamp}.json`)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={!prompt.trim()}
      className={cn(
        'flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 text-[14px] transition-colors',
        exported
          ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
          : 'border-white/[0.08] bg-white/[0.03] text-white/75 hover:border-white/[0.16] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <span className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="font-medium">{exported ? 'Exported!' : 'Export Recipe (JSON)'}</span>
      </span>
    </button>
  )
}

interface RecipeImportProps {
  onImport: (recipe: {
    prompt: string
    negativePrompt?: string
    model?: string
    steps?: number
    seed?: number
    aspectRatio?: string
    preset?: string
    variants?: number
  }) => void
}

export function RecipeImport({ onImport }: RecipeImportProps) {
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as GenerationRecipe

      if (!parsed.prompt || typeof parsed.prompt !== 'string') {
        throw new Error('Invalid recipe: missing prompt')
      }

      haptic('success')
      onImport({
        prompt: parsed.prompt,
        negativePrompt: parsed.negativePrompt,
        model: parsed.model,
        steps: parsed.steps,
        seed: parsed.seed,
        aspectRatio: parsed.aspectRatio,
        preset: parsed.preset,
        variants: parsed.variants,
      })
      setImported(true)
      setTimeout(() => setImported(false), 2000)
    } catch (err) {
      haptic('error')
      setError(err instanceof Error ? err.message : 'Failed to import recipe')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => { haptic('tap'); fileRef.current?.click() }}
        disabled={importing}
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 text-[14px] transition-colors',
          imported
            ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
            : 'border-white/[0.08] bg-white/[0.03] text-white/75 hover:border-white/[0.16] hover:text-white disabled:opacity-40',
        )}
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="font-medium">{imported ? 'Imported!' : importing ? 'Reading...' : 'Import Recipe (JSON)'}</span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && (
        <div className="text-[12px] text-red-300/90 rounded-lg bg-red-500/[0.06] border border-red-500/10 px-2.5 py-1.5">
          {error}
        </div>
      )}
    </div>
  )
}
