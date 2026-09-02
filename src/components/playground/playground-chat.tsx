import { useState, useRef, useEffect } from 'react'
import { usePlaygroundStore, type PlaygroundActivity } from '../../stores/playground-store'
import { useAuthStore } from '../../stores/auth-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useModelCatalog } from '../../hooks/use-model-catalog'
import { useAgentModels } from '../../hooks/use-agent-models'
import { callAgent, DEFAULT_AGENT_MODEL, FALLBACK_AGENT_MODEL } from '../../lib/playground-agent'
import { runAgentTools, type RunStep } from '../../lib/playground-agent-tools'
import { shouldUseModelFallback } from '../../lib/model-routing'
import { cancelVoiceListening, listenForVoice, voiceLocaleShortLabel, type VoiceLocale } from '../../lib/voice-chat'
import {
  NOUR_AGE,
  NOUR_LANGUAGE_LABELS,
  NOUR_NAME,
  NOUR_TAGLINE,
  NOUR_TTS_MODEL,
  NOUR_TTS_VOICE,
  nourTtsLanguage,
  prepareNourSpeechText,
  type NourLanguageMode,
} from '../../lib/nour-character'
import { formatVeniceError, veniceBlob } from '../../lib/venice-client'
import { applyPatch, type WorkflowPatch } from '../../lib/workflow-mutations'
import { generateId } from '../../lib/utils'
import { cn } from '../../lib/utils'

const STARTER_PROMPTS = [
  'Create a polished 9:16 portrait from my idea and prepare it for generation',
  'Edit an uploaded image while preserving the subject’s identity and composition',
  'Build a two-person swap: map one male and one female reference to the matching people in the source image',
  'Research a topic, write a short script, and turn it into a vertical video workflow',
]

function summarizeStep(step: RunStep): PlaygroundActivity {
  const ok = !('error' in step.result) || !step.result.error
  const a = step.args
  switch (step.tool) {
    case 'clear':
      return { tool: step.tool, summary: 'Cleared canvas', ok }
    case 'add_node': {
      const id = (step.result as { id?: string }).id
      const type = String(a.node_type ?? '?')
      return { tool: step.tool, summary: ok ? `Added ${type}${id ? ` "${id}"` : ''}` : `Failed to add ${type}: ${(step.result as { error?: string }).error}`, ok }
    }
    case 'connect': {
      const s = String(a.source ?? ''), t = String(a.target ?? '')
      return { tool: step.tool, summary: ok ? `Connected ${s} → ${t}` : `Connect failed (${s} → ${t}): ${(step.result as { error?: string }).error}`, ok }
    }
    case 'set_params':
      return { tool: step.tool, summary: ok ? `Updated params on ${String(a.id ?? '')}` : `set_params failed: ${(step.result as { error?: string }).error}`, ok }
    case 'remove_node':
      return { tool: step.tool, summary: ok ? `Removed ${String(a.id ?? '')}` : `remove failed: ${(step.result as { error?: string }).error}`, ok }
    case 'pick_model': {
      const model = (step.result as { model?: string }).model
      return { tool: step.tool, summary: ok ? `Picked ${model} for ${String(a.node_type ?? '')}` : 'pick_model failed', ok }
    }
    case 'ask_user':
      return { tool: step.tool, summary: 'Awaiting your reply', ok }
    case 'done':
      return { tool: step.tool, summary: 'Finished', ok }
    default:
      return { tool: step.tool, summary: step.tool, ok }
  }
}

function languageModeForVoice(locale: VoiceLocale): NourLanguageMode {
  return locale === 'ar-EG' ? 'cairo-street' : 'american-egyptian'
}

export function PlaygroundChat() {
  const { messages, draft, isThinking, addMessage, updateMessage, setThinking, applyAgentPatches } = usePlaygroundStore()
  const hasKey = useAuthStore((s) => Boolean(s.apiKey?.trim()))
  const agentModelId = useSettingsStore((s) => s.playgroundAgentModel) || DEFAULT_AGENT_MODEL
  const languageMode = useSettingsStore((s) => s.nourLanguageMode)
  const setLanguageMode = useSettingsStore((s) => s.setNourLanguageMode)
  const { catalog } = useModelCatalog()
  const { models: agentModels, isLoading: agentModelsLoading } = useAgentModels()
  const activeAgentModel = agentModels.find((m) => m.id === agentModelId) || agentModels[0]
  const activeAgentModelId = activeAgentModel?.id || agentModelId
  const agentCaps = activeAgentModel?.capabilities
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [listeningLocale, setListeningLocale] = useState<VoiceLocale | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  const messageCount = messages.length
  const lastMessage = messages[messageCount - 1]
  const lastActivityCount = lastMessage?.activity?.length ?? 0
  const scrollTrigger = `${messageCount}-${Math.floor((lastMessage?.content.length ?? 0) / 200)}-${lastActivityCount}-${isThinking}`
  useEffect(() => {
    if (!shouldStickToBottomRef.current) return
    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollTrigger])

  const stopVoice = () => {
    const current = audioRef.current
    if (current) {
      current.audio.pause()
      URL.revokeObjectURL(current.url)
      audioRef.current = null
    }
    setSpeakingId(null)
  }

  useEffect(() => () => {
    const current = audioRef.current
    if (current) {
      current.audio.pause()
      URL.revokeObjectURL(current.url)
    }
    void cancelVoiceListening()
  }, [])

  const speak = async (id: string, transcript: string, mode: NourLanguageMode = languageMode) => {
    if (speakingId === id) {
      stopVoice()
      return
    }
    if (!hasKey) {
      setError('Connect your Venice API key first.')
      return
    }

    stopVoice()
    setError(null)
    setSpeakingId(id)
    try {
      const blob = await veniceBlob('/audio/speech', {
        model: NOUR_TTS_MODEL,
        voice: NOUR_TTS_VOICE,
        input: prepareNourSpeechText(transcript).slice(0, 4096),
        language: nourTtsLanguage(mode),
        temperature: 0.85,
        response_format: 'mp3',
      })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = { audio, url }
      const finish = () => {
        if (audioRef.current?.audio === audio) {
          URL.revokeObjectURL(url)
          audioRef.current = null
          setSpeakingId(null)
        }
      }
      audio.addEventListener('ended', finish, { once: true })
      audio.addEventListener('error', finish, { once: true })
      await audio.play()
    } catch (e) {
      stopVoice()
      setError(formatVeniceError(e))
    }
  }

  const send = async (text: string, options: { languageMode?: NourLanguageMode; autoSpeak?: boolean } = {}) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return
    if (!hasKey) {
      setError('Connect your Venice API key first.')
      return
    }
    if (agentModelsLoading) {
      setError('Noor is still loading the available models. Try again in a moment.')
      return
    }
    if (!activeAgentModel) {
      setError('No compatible Noor model is currently available from Venice.')
      return
    }
    const effectiveLanguageMode = options.languageMode ?? languageMode
    setError(null)
    setInput('')
    shouldStickToBottomRef.current = true

    const userMsg = { id: generateId(), role: 'user' as const, content: trimmed }
    const pendingMsg = { id: generateId(), role: 'assistant' as const, content: '', pending: true, activity: [] }
    addMessage(userMsg)
    addMessage(pendingMsg)
    setThinking(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    let spokenReply = ''

    const history = messages
      .filter((m) => !m.pending && !m.error)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const useTools = agentCaps?.supportsFunctionCalling === true

      if (useTools) {
        const activity: PlaygroundActivity[] = []
        const result = await runAgentTools({
          userMessage: trimmed,
          draft,
          history,
          catalog,
          agentModels,
          model: activeAgentModelId,
          capabilities: agentCaps,
          languageMode: effectiveLanguageMode,
          signal: controller.signal,
          applyPatch: (patch: WorkflowPatch) => {
            try {
              const current = usePlaygroundStore.getState().draft
              const r = applyPatch({ nodes: current.nodes, edges: current.edges }, patch)
              usePlaygroundStore.setState({ draft: { nodes: r.nodes, edges: r.edges } })
              return { ok: true, id: r.addedNodeId, edge_id: r.addedEdgeId }
            } catch (e) {
              return { error: e instanceof Error ? e.message : 'Patch failed' }
            }
          },
          onStep: (step) => {
            activity.push(summarizeStep(step))
            updateMessage(pendingMsg.id, { activity: [...activity] })
          },
        })

        spokenReply = result.say || 'Done.'
        updateMessage(pendingMsg.id, {
          content: spokenReply,
          activity,
          pending: false,
        })
      } else {
        const requestAgent = (modelId: string, capabilities: typeof agentCaps) => callAgent({
          userMessage: trimmed,
          draft,
          history,
          catalog,
          model: modelId,
          capabilities,
          languageMode: effectiveLanguageMode,
          signal: controller.signal,
        })

        let response: Awaited<ReturnType<typeof callAgent>>
        try {
          response = await requestAgent(activeAgentModelId, agentCaps)
        } catch (requestError) {
          const fallback = agentModels.find((candidate) => (
            candidate.id === FALLBACK_AGENT_MODEL && candidate.id !== activeAgentModelId
          )) || agentModels.find((candidate) => candidate.id !== activeAgentModelId)
          const canFallback = fallback && shouldUseModelFallback(requestError, { aborted: controller.signal.aborted })
          if (!canFallback) throw requestError
          response = await requestAgent(fallback.id, fallback.capabilities)
        }

        let patchError: string | undefined
        try {
          if (response.patches.length > 0) applyAgentPatches(response.patches)
        } catch (e) {
          patchError = e instanceof Error ? e.message : 'Failed to apply patches'
        }

        const invalidNote = response.invalidPatches > 0
          ? ` (${response.invalidPatches} invalid patch${response.invalidPatches === 1 ? '' : 'es'} ignored)`
          : ''

        const fallbackSay = response.patches.length === 0 && !response.say
          ? 'The agent returned an unparseable response. Try a different model from the picker above, or simplify the request.'
          : response.say || (response.patches.length > 0 ? 'Updated the workflow.' : '')

        spokenReply = fallbackSay + invalidNote
        updateMessage(pendingMsg.id, {
          content: spokenReply,
          patches: response.patches,
          error: patchError,
          pending: false,
        })
      }
    } catch (e) {
      if (controller.signal.aborted) {
        updateMessage(pendingMsg.id, { content: '', error: 'Cancelled', pending: false })
      } else {
        const message = formatVeniceError(e)
        updateMessage(pendingMsg.id, { content: '', error: message, pending: false })
      }
    } finally {
      setThinking(false)
      abortRef.current = null
    }

    if (options.autoSpeak && spokenReply.trim() && !controller.signal.aborted) {
      await speak(pendingMsg.id, spokenReply, effectiveLanguageMode)
    }
  }

  const listenAndSend = async (locale: VoiceLocale) => {
    if (isThinking) return
    if (listeningLocale) {
      await cancelVoiceListening()
      setListeningLocale(null)
      return
    }

    stopVoice()
    setError(null)
    setListeningLocale(locale)
    try {
      const result = await listenForVoice(locale)
      if (result.cancelled || !result.text.trim()) return
      const mode = languageModeForVoice(locale)
      setLanguageMode(mode)
      await send(result.text, { languageMode: mode, autoSpeak: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice recognition failed')
    } finally {
      setListeningLocale(null)
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="flex h-full max-w-full min-w-0 flex-col overflow-hidden bg-[#0c0c10]">
      <div
        ref={scrollRef}
        className="touch-pan-y max-w-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        onScroll={(event) => {
          const element = event.currentTarget
          shouldStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 pt-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 via-rose-300 to-fuchsia-700 p-[1px] shadow-lg shadow-fuchsia-950/30 shrink-0">
                <img src="/nour-portrait.png" alt="Noor" className="w-full h-full rounded-full object-cover object-[50%_18%]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] text-white font-semibold">{NOUR_NAME}</span>
                  <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">{NOUR_AGE} · Adult</span>
                </div>
                <div className="text-[12px] text-white/45 truncate">{NOUR_TAGLINE}</div>
              </div>
            </div>
            <div className="text-[15px] text-white/85 font-semibold mb-1">Tell me what you want done.</div>
            <div className="text-[13px] text-white/45 mb-4">Chat naturally or use the English / Egyptian microphone buttons below. Noor can answer by voice and execute supported agent commands.</div>
            <div className="flex flex-col gap-2">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-left px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04] transition-all text-[13px] text-white/65 hover:text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex flex-col gap-1.5', m.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] min-w-0 break-words [overflow-wrap:anywhere] px-3.5 py-2 rounded-xl text-[13.5px] leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-white/[0.09] text-white border border-white/[0.05]'
                      : 'bg-white/[0.04] border border-white/[0.07] text-white/85',
                  )}
                >
                  {m.pending && (!m.activity || m.activity.length === 0) ? (
                    <span className="text-white/45 inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 border-2 border-white/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                      Thinking…
                    </span>
                  ) : m.error ? (
                    <span className="text-red-300/95">{m.error}</span>
                  ) : (
                    m.content || <span className="text-white/35 italic">(no message)</span>
                  )}
                </div>

                {m.role === 'assistant' && !m.pending && !m.error && m.content && (
                  <button
                    type="button"
                    onClick={() => void speak(m.id, m.content)}
                    aria-label={speakingId === m.id ? 'Stop Noor voice' : 'Play Noor voice'}
                    className="min-h-11 px-3 rounded-lg text-[12px] text-white/55 hover:text-white/85 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    {speakingId === m.id ? '■ Stop voice' : '▶ Play Noor voice'}
                  </button>
                )}

                {m.activity && m.activity.length > 0 && (
                  <div className="flex max-w-[88%] min-w-0 flex-col gap-px break-words [overflow-wrap:anywhere] px-1 font-mono text-[11.5px] text-white/45">
                    {m.activity.map((a, i) => (
                      <div key={i} className={cn('flex items-center gap-1.5', !a.ok && 'text-rose-300/85')}>
                        <span className="text-white/30">·</span>
                        <span>{a.summary}</span>
                      </div>
                    ))}
                    {m.pending && (
                      <div className="flex items-center gap-1.5 text-white/35">
                        <span className="inline-block w-2 h-2 border border-white/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                        <span>Working…</span>
                      </div>
                    )}
                  </div>
                )}

                {m.patches && m.patches.length > 0 && !m.activity?.length && (
                  <div className="max-w-[88%] px-3 py-1 text-[11px] text-white/40 font-mono tracking-wide">
                    {m.patches.length} patch{m.patches.length === 1 ? '' : 'es'} applied
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-full min-w-0 shrink-0 overflow-x-hidden border-t border-white/[0.06] p-3">
        <div className="touch-pan-x mb-2 flex max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5" aria-label="Noor language mode">
          {(Object.entries(NOUR_LANGUAGE_LABELS) as Array<[NourLanguageMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                stopVoice()
                setLanguageMode(mode)
              }}
              aria-pressed={languageMode === mode}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-3 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]',
                languageMode === mode
                  ? 'border-fuchsia-300/40 bg-fuchsia-400/15 text-white'
                  : 'border-white/[0.09] bg-white/[0.03] text-white/55 hover:text-white/85',
              )}
            >
              {label}
            </button>
          ))}
          <span className="shrink-0 text-[11px] text-white/35">Voice · {NOUR_TTS_VOICE}</span>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2" aria-label="Noor voice commands">
          <button
            type="button"
            disabled={isThinking || Boolean(listeningLocale)}
            onClick={() => void listenAndSend('en-US')}
            className={cn(
              'min-h-11 rounded-xl border px-3 text-[12px] font-semibold transition-colors disabled:opacity-40',
              listeningLocale === 'en-US'
                ? 'border-rose-300/35 bg-rose-300/10 text-rose-100'
                : 'border-white/[0.09] bg-white/[0.035] text-white/70 hover:text-white',
            )}
          >
            {listeningLocale === 'en-US' ? '● Listening EN…' : '🎙 Mic EN'}
          </button>
          <button
            type="button"
            disabled={isThinking || Boolean(listeningLocale)}
            onClick={() => void listenAndSend('ar-EG')}
            className={cn(
              'min-h-11 rounded-xl border px-3 text-[12px] font-semibold transition-colors disabled:opacity-40',
              listeningLocale === 'ar-EG'
                ? 'border-rose-300/35 bg-rose-300/10 text-rose-100'
                : 'border-white/[0.09] bg-white/[0.035] text-white/70 hover:text-white',
            )}
          >
            {listeningLocale === 'ar-EG' ? '● Listening مصري…' : '🎙 Mic مصري'}
          </button>
        </div>
        {listeningLocale && <div className="mb-2 text-center text-[11px] text-white/45">Listening · {voiceLocaleShortLabel(listeningLocale)} · speak naturally, then Noor will send and answer by voice.</div>}
        {error && <div role="alert" className="mb-2 break-words [overflow-wrap:anywhere] text-[13px] text-red-300/95">{error}</div>}
        <div className="flex max-w-full min-w-0 items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder={isThinking ? 'Noor is working…' : 'Message Noor or ask her to create something…'}
            rows={2}
            disabled={isThinking || Boolean(listeningLocale)}
            aria-label="Message Noor"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[16px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/[0.2] disabled:opacity-60"
          />
          {isThinking ? (
            <button
              onClick={cancel}
              className="shrink-0 min-h-11 px-3 py-2 text-[13px] text-white/85 hover:text-white border border-white/[0.12] hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || !hasKey || agentModelsLoading || !activeAgentModel || Boolean(listeningLocale)}
              className="shrink-0 min-h-11 px-4 py-2 text-[13px] font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
