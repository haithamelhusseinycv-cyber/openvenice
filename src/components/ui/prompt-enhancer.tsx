import { useState, useCallback } from 'react'
import { useAuthStore } from '../../stores/auth-store'
import { venice } from '../../lib/venice-client'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface PromptEnhancerProps {
  currentPrompt: string
  onEnhanced: (enhanced: string) => void
  disabled?: boolean
}

export function PromptEnhancer({ currentPrompt, onEnhanced, disabled }: PromptEnhancerProps) {
  const [loading, setLoading] = useState(false)
  const apiKey = useAuthStore((s) => s.apiKey)

  const enhance = useCallback(async () => {
    if (!currentPrompt.trim() || !apiKey || loading) return

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
              content: 'You are an expert prompt engineer for AI image generation. Enhance the user\'s prompt to produce better, more detailed, more photorealistic results. Add specific details about lighting, composition, texture, and quality. Keep it under 200 words. Return ONLY the enhanced prompt, nothing else.',
            },
            {
              role: 'user',
              content: currentPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
          include_venice_system_prompt: false,
        }),
      })

      const enhanced = response.choices?.[0]?.message?.content?.trim()
      if (enhanced) {
        haptic('success')
        onEnhanced(enhanced)
      }
    } catch (error) {
      console.error('Prompt enhancement failed:', error)
      haptic('error')
    } finally {
      setLoading(false)
    }
  }, [currentPrompt, apiKey, loading, onEnhanced])

  return (
    <button
      type="button"
      onClick={enhance}
      disabled={disabled || loading || !currentPrompt.trim() || !apiKey}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all min-h-9',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
        loading
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] cursor-wait'
          : disabled || !currentPrompt.trim() || !apiKey
            ? 'bg-white/[0.03] text-white/30 cursor-not-allowed'
            : 'bg-gradient-to-r from-[var(--color-accent)]/20 to-[var(--color-accent)]/10 text-[var(--color-accent)] hover:from-[var(--color-accent)]/30 hover:to-[var(--color-accent)]/20 active:scale-95'
      )}
      aria-label="Enhance prompt with AI"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Enhancing…</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
          <span>Make it better</span>
        </>
      )}
    </button>
  )
}
