import { useState } from 'react'
import { venice } from '../../lib/venice-client'
import { useAuthStore } from '../../stores/auth-store'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface SmartNegativeSuggesterProps {
  prompt: string
  onSuggest: (negative: string) => void
}

export function SmartNegativeSuggester({ prompt, onSuggest }: SmartNegativeSuggesterProps) {
  const [loading, setLoading] = useState(false)
  const apiKey = useAuthStore((s) => s.apiKey)

  const suggestNegative = async () => {
    if (!prompt.trim() || !apiKey || loading) return

    haptic('tap')
    setLoading(true)

    try {
      const response = await venice<{ choices: Array<{ message: { content: string } }> }>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at AI image generation. Given a prompt, suggest a negative prompt (things to avoid) to improve image quality. Respond with ONLY the negative prompt text, no explanation. Keep it under 200 characters. Focus on common issues: blurry, deformed, extra limbs, bad anatomy, low quality, watermark, text, CGI look.',
            },
            {
              role: 'user',
              content: `Prompt: ${prompt}`,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      })

      const suggestion = response.choices?.[0]?.message?.content?.trim()
      if (suggestion) {
        haptic('success')
        onSuggest(suggestion)
      }
    } catch (error) {
      console.error('Negative suggest failed:', error)
      haptic('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={suggestNegative}
      disabled={loading || !prompt.trim() || !apiKey}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all min-h-8',
        loading
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] cursor-wait'
          : !prompt.trim() || !apiKey
            ? 'bg-white/[0.03] text-white/30 cursor-not-allowed'
            : 'bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 active:scale-95'
      )}
      title="AI suggests negative prompt"
    >
      {loading ? (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      <span>{loading ? 'Thinking…' : 'Suggest negative'}</span>
    </button>
  )
}
