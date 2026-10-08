import { useState } from 'react'
import { venice } from '../../lib/venice-client'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface PromptTranslatorProps {
  prompt: string
  onTranslate: (translated: string) => void
  disabled?: boolean
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
]

export function PromptTranslator({ prompt, onTranslate, disabled }: PromptTranslatorProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [targetLang, setTargetLang] = useState('en')

  const translate = async (lang: string) => {
    if (!prompt.trim() || disabled) return
    setTargetLang(lang)
    setLoading(true)
    haptic('tap')

    try {
      const langName = LANGUAGES.find((l) => l.code === lang)?.label ?? lang
      const res = await venice<{ choices: Array<{ message: { content: string } }> }>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: `You are a precise translator for image generation prompts. Translate the user's prompt to ${langName}. Keep it concise and optimized for AI image generation. Only output the translated prompt, nothing else.`,
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.3,
          include_venice_system_prompt: false,
        }),
      })

      const translated = res.choices?.[0]?.message?.content?.trim()
      if (translated) {
        haptic('success')
        onTranslate(translated)
        setOpen(false)
      }
    } catch {
      haptic('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || loading || !prompt.trim()}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all min-h-9',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
          open
            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
            : disabled || !prompt.trim()
              ? 'bg-white/[0.03] text-white/30 cursor-not-allowed'
              : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white active:scale-95'
        )}
        aria-label="Translate prompt"
      >
        {loading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8l6 6" />
            <path d="M4 14l6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="M22 22l-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[160px] rounded-xl bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden">
          <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => translate(lang.code)}
                disabled={loading}
                className={cn(
                  'text-left text-[13px] px-3 py-2 rounded-lg transition-colors min-h-8',
                  lang.code === targetLang
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
