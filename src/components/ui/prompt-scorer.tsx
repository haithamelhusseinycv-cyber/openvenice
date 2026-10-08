import { useState } from 'react'
import { venice } from '../../lib/venice-client'
import { useAuthStore } from '../../stores/auth-store'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface PromptScorerProps {
  prompt: string
  onScoreReady: (score: number, feedback: string) => void
}

export function PromptScorer({ prompt, onScoreReady }: PromptScorerProps) {
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string>('')
  const apiKey = useAuthStore((s) => s.apiKey)

  const scorePrompt = async () => {
    if (!prompt.trim() || !apiKey || loading) return
    haptic('tap')
    setLoading(true)

    try {
      const res = await venice<{ choices: Array<{ message: { content: string } }> }>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at evaluating AI image generation prompts. Rate this prompt from 1-10 based on: clarity (25%), detail (25%), specificity (25%), feasibility (25%). Provide a brief 1-sentence feedback. Format: "SCORE: X/10\nFEEDBACK: ..." Keep feedback under 100 chars.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 80,
          temperature: 0.3,
          include_venice_system_prompt: false,
        }),
      })

      const content = res.choices?.[0]?.message?.content?.trim() || ''
      const scoreMatch = content.match(/SCORE:\s*(\d+)\/10/i)
      const feedbackMatch = content.match(/FEEDBACK:\s*(.+)/i)

      if (scoreMatch && feedbackMatch) {
        const s = parseInt(scoreMatch[1])
        const f = feedbackMatch[1].trim()
        setScore(s)
        setFeedback(f)
        haptic(s >= 7 ? 'success' : s >= 5 ? 'select' : 'error')
        onScoreReady(s, f)
      }
    } catch (error) {
      console.error('Prompt scoring failed:', error)
      haptic('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={scorePrompt}
        disabled={loading || !prompt.trim() || !apiKey}
        className={cn(
          'flex items-center justify-between rounded-xl border px-3 py-2.5 text-[14px] transition-all min-h-11',
          score !== null
            ? score >= 7
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : score >= 5
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-white/[0.08] bg-white/[0.03] text-white/75 hover:border-white/[0.16] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        <span className="font-medium">
          {loading ? 'Scoring…' : score !== null ? `Quality: ${score}/10` : 'Score Prompt Quality'}
        </span>
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        )}
      </button>
      {feedback && (
        <div className="text-[12px] text-white/60 px-1">{feedback}</div>
      )}
    </div>
  )
}
