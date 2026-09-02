import { isValidElement, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, ContentPart } from '../../types/venice'
import { cn } from '../../lib/utils'

// Allow http/https/mailto links and image data: URIs only. Strips javascript:,
// vbscript:, file:, and any other smuggled protocols.
const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|#|\/|\.)/i
function safeUrlTransform(url: string, key: string): string {
  if (!url) return ''
  const cleaned = defaultUrlTransform(url)
  if (!cleaned) return ''
  if (key === 'src' && cleaned.startsWith('data:image/')) return cleaned
  if (SAFE_URL_PROTOCOLS.test(cleaned)) return cleaned
  return ''
}

function CodeBlock({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) {
  if (!className && !String(children).includes('\n')) {
    return <code className={className} {...props}>{children}</code>
  }

  return <code className={className} {...props}>{children}</code>
}

function reactNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(reactNodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return reactNodeText(node.props.children)
  return ''
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Copy failed')
}

function PromptCodeBox({ children, className }: ComponentPropsWithoutRef<'pre'>) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const codeText = reactNodeText(children).replace(/\n$/, '')

  const handleCopyAll = async () => {
    try {
      await copyText(codeText)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1800)
  }

  return (
    <div className="prompt-code-box">
      <button
        type="button"
        onClick={() => { void handleCopyAll() }}
        aria-label="Copy everything in this box"
        className="absolute right-2 top-2 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#1b1b20] px-3 py-1.5 text-[12px] font-semibold text-white/85 shadow-lg transition-colors hover:bg-[#25252b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Try again' : 'Copy all'}
      </button>
      <pre className={['prompt-code-scroll', className].filter(Boolean).join(' ')}>{children}</pre>
    </div>
  )
}

function extractContent(content: string | ContentPart[]): { text: string; images: string[] } {
  if (typeof content === 'string') return { text: content, images: [] }
  let text = ''
  const images: string[] = []
  for (const part of content) {
    if (part.type === 'text' && part.text) text += part.text
    if (part.type === 'image_url' && part.image_url?.url) images.push(part.image_url.url)
  }
  return { text, images }
}

interface MessageBubbleProps {
  message: ChatMessage
  index: number
  onCopy: () => void
  onDelete: () => void
  onRegenerate?: () => void
}

export function MessageBubble({ message, onCopy, onDelete, onRegenerate }: MessageBubbleProps) {
  const [hovering, setHovering] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const isUser = message.role === 'user'
  const { text: content, images } = extractContent(message.content)
  const artifacts = message.artifacts || []

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 1500)
  }

  const actions = (
    <div className={`flex min-h-11 flex-wrap items-center gap-1 opacity-100 transition-opacity duration-150 ${hovering ? 'lg:opacity-100' : 'lg:opacity-60'}`}>
      <ActionBtn label={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        )}
      </ActionBtn>
      {!isUser && onRegenerate && (
        <ActionBtn label="Regenerate" onClick={onRegenerate}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
        </ActionBtn>
      )}
      <ActionBtn label="Delete" onClick={onDelete}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
      </ActionBtn>
    </div>
  )

  if (isUser) {
    return (
      <div className="flex justify-end" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div className="flex max-w-[90%] min-w-0 flex-col items-end sm:max-w-[78%]">
          <div className="min-w-0 rounded-2xl rounded-br-md border border-white/[0.05] bg-white/[0.07] px-3 py-2.5 shadow-sm sm:px-4">
            {images.length > 0 && (
              <div className="flex gap-1.5 mb-2">
                {images.map((img, i) => (
                  <img key={i} src={img} alt={`Attachment ${i + 1}`} className="h-24 rounded-lg border border-white/[0.06]" />
                ))}
              </div>
            )}
            <div className="text-white/95 text-[15.5px] leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </div>
          </div>
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-w-full min-w-0 gap-2 overflow-x-hidden sm:gap-3" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/95 to-white/75 shadow-sm sm:h-8 sm:w-8">
        <svg viewBox="0 0 32 32" width="14" height="14" fill="none">
          <g fill="#0a0a0c">
            <rect x="6.2" y="7.5" width="1.6" height="18" rx="0.8" transform="rotate(-42 6.2 7.5)" />
            <rect x="24.2" y="6.3" width="1.6" height="18" rx="0.8" transform="rotate(42 24.2 6.3)" />
            <polygon points="7.2,8.8 3.8,7.2 4.5,5.5 8.5,7.2" />
            <polygon points="24.8,8.8 28.2,7.2 27.5,5.5 23.5,7.2" />
            <rect x="14.3" y="14.3" width="3.4" height="3.4" rx="0.4" transform="rotate(45 16 16)" />
            <circle cx="9.2" cy="24.5" r="4" />
            <circle cx="9.2" cy="24.5" r="1.7" fill="#fff" />
            <circle cx="22.8" cy="24.5" r="4" />
            <circle cx="22.8" cy="24.5" r="1.7" fill="#fff" />
            <path d="M16 5.5L12.5 8.5V12.5L16 10.5L19.5 12.5V8.5Z" />
          </g>
        </svg>
      </div>
      <div className="max-w-full min-w-0 flex-1 overflow-x-hidden">
        {message.reasoning_content && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setReasoningOpen(!reasoningOpen)}
              className="flex items-center gap-1.5 text-[14px] text-white/20 hover:text-white/35 transition-colors mb-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={cn('transition-transform duration-150', reasoningOpen && 'rotate-90')}>
                <path d="M3.5 2L6.5 5L3.5 8" />
              </svg>
              Thinking
            </button>
            {reasoningOpen && (
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-[15px] text-white/30 leading-relaxed whitespace-pre-wrap animate-fade-in max-h-60 overflow-y-auto">
                {message.reasoning_content}
              </div>
            )}
          </div>
        )}

        {content ? (
          <div className="prose-venice text-[15.5px] leading-relaxed text-white/85">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={safeUrlTransform}
              components={{
                pre: PromptCodeBox,
                code: CodeBlock,
                a: ({ href, children, ...props }) => (
                  <a {...props} href={href} target="_blank" rel="noopener noreferrer ugc">
                    {children}
                  </a>
                ),
              }}
            >{content}</ReactMarkdown>
          </div>
        ) : artifacts.length === 0 ? (
          <span className="inline-flex gap-1.5 py-1.5">
            <span className="w-1 h-1 rounded-full bg-white/25 animate-pulse-dot" />
            <span className="w-1 h-1 rounded-full bg-white/25 animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
            <span className="w-1 h-1 rounded-full bg-white/25 animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
          </span>
        ) : null}

        {artifacts.length > 0 && (
          <div className="mt-3 flex max-w-full flex-col gap-2">
            {artifacts.map((artifact) => (
              <figure key={artifact.id} className="max-w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                <img
                  src={artifact.url}
                  alt={artifact.sourceTool === 'localdream.upscale' ? 'Upscaled Local Dream result' : 'Local Dream result'}
                  className="block h-auto max-h-[70vh] w-full max-w-full object-contain"
                />
                <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/[0.06] px-2.5 py-2 text-[11px] text-white/35">
                  <span>{artifact.sourceTool || 'Agent image tool'}</span>
                  {artifact.width && artifact.height ? <span>{artifact.width}×{artifact.height}</span> : null}
                  {artifact.format ? <span>{artifact.format.toUpperCase()}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="mt-0.5">{actions}</div>
        {(message.served_model || message.requested_model) && (
          <div className="mt-0.5 break-all text-[10.5px] text-white/25">
            {message.served_model && message.requested_model && message.served_model !== message.requested_model
              ? `Requested ${message.requested_model} · Served ${message.served_model}`
              : `Model: ${message.served_model || message.requested_model}`}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white/80"
    >
      {children}
      <span>{label}</span>
    </button>
  )
}
