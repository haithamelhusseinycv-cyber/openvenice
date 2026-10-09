import { useState, useRef } from 'react'
import { venice } from '../../lib/venice-client'
import { useAuthStore } from '../../stores/auth-store'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface ImageToPromptProps {
  onPromptExtracted: (prompt: string) => void
  disabled?: boolean
}

export function ImageToPrompt({ onPromptExtracted, disabled }: ImageToPromptProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const apiKey = useAuthStore((s) => s.apiKey)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      await extractPrompt(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const extractPrompt = async (imageDataUrl: string) => {
    if (!apiKey || loading) return
    haptic('tap')
    setLoading(true)

    try {
      const base64 = imageDataUrl.split(',')[1]
      const res = await venice<{ choices: Array<{ message: { content: string } }> }>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'llama-3.2-vision-11b',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at reverse-engineering image generation prompts. Analyze this image and write a detailed prompt that would recreate it. Focus on: subject, style, lighting, composition, colors, mood. Output ONLY the prompt, no explanation. Keep it under 300 characters.',
            },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
                { type: 'text', text: 'Extract the generation prompt' },
              ],
            },
          ],
          max_tokens: 200,
          temperature: 0.5,
          include_venice_system_prompt: false,
        }),
      })

      const prompt = res.choices?.[0]?.message?.content?.trim()
      if (prompt) {
        haptic('success')
        onPromptExtracted(prompt)
      }
    } catch (error) {
      console.error('Image-to-prompt failed:', error)
      haptic('error')
    } finally {
      setLoading(false)
      setPreview(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer min-h-[120px]',
          loading
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-white/[0.12] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]'
        )}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-6 w-6 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-[13px] text-white/60">Analyzing image…</span>
          </>
        ) : preview ? (
          <>
            <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
            <span className="text-[13px] text-white/60">Extracting prompt…</span>
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-[13px] text-white/50">Upload image to extract prompt</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
        className="hidden"
        disabled={disabled || loading}
      />
    </div>
  )
}
