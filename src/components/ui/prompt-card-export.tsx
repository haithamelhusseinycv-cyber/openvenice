import { useRef } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface PromptCardExportProps {
  prompt: string
  negativePrompt?: string
  model?: string
  onExported?: () => void
}

export function PromptCardExport({ prompt, negativePrompt, model, onExported }: PromptCardExportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const exportCard = async () => {
    const canvas = canvasRef.current
    if (!canvas || !prompt.trim()) return

    haptic('tap')

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 1080
    const height = 1080
    canvas.width = width
    canvas.height = height

    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#0f0f0f')
    gradient.addColorStop(0.5, '#1a1a2e')
    gradient.addColorStop(1, '#0f0f0f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(110, 231, 211, 0.15)'
    ctx.lineWidth = 4
    ctx.strokeRect(40, 40, width - 80, height - 80)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
    ctx.fillText('CHILLI AI', 80, 120)

    if (model) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '20px system-ui, -apple-system, sans-serif'
      ctx.fillText(model, 80, 160)
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = '24px system-ui, -apple-system, sans-serif'
    const promptLines = wrapText(ctx, prompt, width - 160)
    let y = model ? 220 : 180
    for (const line of promptLines.slice(0, 12)) {
      ctx.fillText(line, 80, y)
      y += 36
    }

    if (negativePrompt) {
      y += 20
      ctx.fillStyle = 'rgba(255, 100, 100, 0.7)'
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
      ctx.fillText('NEGATIVE:', 80, y)
      y += 30
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '18px system-ui, -apple-system, sans-serif'
      const negLines = wrapText(ctx, negativePrompt, width - 160)
      for (const line of negLines.slice(0, 4)) {
        ctx.fillText(line, 80, y)
        y += 28
      }
    }

    ctx.fillStyle = 'rgba(110, 231, 211, 0.6)'
    ctx.font = '16px system-ui, -apple-system, sans-serif'
    ctx.fillText('chilli.ai', 80, height - 80)

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `chilli-prompt.png`
    link.href = dataUrl
    link.click()

    haptic('success')
    onExported?.()
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  return (
    <>
      <button
        type="button"
        onClick={() => exportCard()}
        disabled={!prompt.trim()}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all min-h-9',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
          !prompt.trim()
            ? 'bg-white/[0.03] text-white/30 cursor-not-allowed'
            : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white active:scale-95'
        )}
        aria-label="Export prompt as card"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </>
  )
}
