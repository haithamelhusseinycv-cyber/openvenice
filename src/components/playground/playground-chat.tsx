import { useState, useRef, useEffect } from 'react'
import { usePlaygroundStore, type PlaygroundActivity } from '../../stores/playground-store'
import { useAuthStore } from '../../stores/auth-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useVoiceStore } from '../../stores/voice-store'
import { useModelCatalog } from '../../hooks/use-model-catalog'
import { useAgentModels } from '../../hooks/use-agent-models'
import { callAgent, DEFAULT_AGENT_MODEL, FALLBACK_AGENT_MODEL } from '../../lib/playground-agent'
import { runAgentTools, type RunStep } from '../../lib/playground-agent-tools'
import { shouldUseModelFallback } from '../../lib/model-routing'
import { cancelVoiceListening, listenForVoice, speakBinaryNative, speakVoice, stopVoiceSpeaking, isNativeAndroid, type VoiceLocale } from '../../lib/voice-chat'
import {
  NOUR_AGE,
  NOUR_LANGUAGE_LABEL,
  NOUR_LANGUAGE_LABELS,
  NOUR_NAME,
  NOUR_TAGLINE,
  NOUR_TTS_MODEL,
  NOUR_TTS_VOICE,
  nourTtsLanguage,
  splitNourSpeechText,
  type NourLanguageMode,
} from '../../lib/nour-character'
import { formatVeniceError, veniceBlob } from '../../lib/venice-client'
import { applyPatch, type WorkflowPatch } from '../../lib/workflow-mutations'
import { generateId } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'
import { BottomSheet } from '../ui/bottom-sheet'
import { SegmentedControl } from '../ui/segmented-control'

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

function languageModeForVoice(_locale: VoiceLocale): NourLanguageMode {
  return 'dual-dialect'
}

export function PlaygroundChat() {
  const { messages, draft, isThinking, addMessage, updateMessage, setThinking, applyAgentPatches } = usePlaygroundStore()
  const hasKey = useAuthStore((s) => Boolean(s.apiKey?.trim()))
  const agentModelId = useSettingsStore((s) => s.playgroundAgentModel) || DEFAULT_AGENT_MODEL
  const languageMode = useSettingsStore((s) => s.nourLanguageMode)
  const setLanguageMode = useSettingsStore((s) => s.setNourLanguageMode)
  const speakReplies = useVoiceStore((s) => s.speakReplies)
  const setSpeakReplies = useVoiceStore((s) => s.setSpeakReplies)
  const playbackMode = useVoiceStore((s) => s.playbackMode)
  const setPlaybackMode = useVoiceStore((s) => s.setPlaybackMode)
  const voiceRate = useVoiceStore((s) => s.voiceRate)
  const { catalog } = useModelCatalog()
  const { models: agentModels, isLoading: agentModelsLoading } = useAgentModels()
  const activeAgentModel = agentModels.find((m) => m.id === agentModelId) || agentModels[0]
  const activeAgentModelId = activeAgentModel?.id || agentModelId
  const agentCaps = activeAgentModel?.capabilities
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)
  const [listeningLocale, setListeningLocale] = useState<VoiceLocale | null>(null)
  const [sessionOpen, setSessionOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)
  const speechAbortRef = useRef<AbortController | null>(null)
  const speechSessionRef = useRef(0)

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
    speechSessionRef.current += 1
    speechAbortRef.current?.abort()
    speechAbortRef.current = null
    void stopVoiceSpeaking()
    const current = audioRef.current
    if (current) {
      current.audio.pause()
      URL.revokeObjectURL(current.url)
      audioRef.current = null
    }
    setSpeakingId(null)
    setVoiceStatus(null)
  }

  useEffect(() => () => {
    speechSessionRef.current += 1
    speechAbortRef.current?.abort()
    const current = audioRef.current
    if (current) {
      current.audio.pause()
      URL.revokeObjectURL(current.url)
    }
    void stopVoiceSpeaking()
    void cancelVoiceListening()
  }, [])

  const speak = async (id: string, transcript: string, mode: NourLanguageMode = languageMode) => {
    if (speakingId === id) {
      stopVoice()
      return
    }
    if (playbackMode === 'studio' && !hasKey) {
      setError('Connect your Venice API key first.')
      return
    }

    stopVoice()
    const session = ++speechSessionRef.current
    const controller = new AbortController()
    speechAbortRef.current = controller
    setError(null)
    setSpeakingId(id)
    // Mobile browser speech engines are more reliable with short utterances;
    // studio TTS can use larger chunks because each one is a complete file.
    const segments = playbackMode === 'fast'
      ? splitNourSpeechText(transcript, 180, 280)
      : splitNourSpeechText(transcript)
    if (segments.length === 0) {
      stopVoice()
      return
    }

    const locale: VoiceLocale = 'en-US'
    let completedSegments = 0

    const speakFast = async (from = 0) => {
      for (let index = from; index < segments.length; index += 1) {
        if (controller.signal.aborted || speechSessionRef.current !== session) return
        setVoiceStatus(`Speaking ${index + 1} of ${segments.length}`)
        await speakVoice(segments[index], locale, {
          // voice-store already clamps voiceRate to 0.5..2; honour slower rates
          // instead of forcing fast mode to >= 1.0.
          rate: voiceRate,
          signal: controller.signal,
        })
        completedSegments = index + 1
      }
    }

    const requestStudioSegment = (segment: string) => veniceBlob('/audio/speech', {
      model: NOUR_TTS_MODEL,
      voice: NOUR_TTS_VOICE,
      input: segment,
      language: nourTtsLanguage(mode),
      temperature: 0.85,
      response_format: 'mp3',
    }, { signal: controller.signal })
      .then((blob) => ({ blob }))
      .catch((requestError: unknown) => ({ error: requestError }))

    const playStudioBlob = async (blob: Blob, index: number) => {
      setVoiceStatus(`Speaking ${index + 1} of ${segments.length}`)

      if (isNativeAndroid()) {
        // Native MediaPlayer path — reliable blob playback inside the app.
        await speakBinaryNative(blob, controller.signal)
        return
      }

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.preload = 'auto'
      audioRef.current = { audio, url }
      setVoiceStatus(`Speaking ${index + 1} of ${segments.length}`)

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          controller.signal.removeEventListener('abort', onAbort)
          if (audioRef.current?.audio === audio) audioRef.current = null
          URL.revokeObjectURL(url)
        }
        const onEnded = () => { cleanup(); resolve() }
        const onError = () => { cleanup(); reject(new Error('Studio voice playback failed')) }
        const onAbort = () => {
          audio.pause()
          cleanup()
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        }
        audio.addEventListener('ended', onEnded, { once: true })
        audio.addEventListener('error', onError, { once: true })
        controller.signal.addEventListener('abort', onAbort, { once: true })
        audio.play().catch((playError) => { cleanup(); reject(playError) })
      })
    }

    try {
      if (playbackMode === 'fast') {
        await speakFast()
      } else {
        let pending = requestStudioSegment(segments[0])
        for (let index = 0; index < segments.length; index += 1) {
          setVoiceStatus(`Preparing ${index + 1} of ${segments.length}`)
          const result = await pending
          if ('error' in result) throw result.error
          if (controller.signal.aborted || speechSessionRef.current !== session) return
          pending = index + 1 < segments.length
            ? requestStudioSegment(segments[index + 1])
            : Promise.resolve({ blob: new Blob() })
          try {
            await playStudioBlob(result.blob, index)
            completedSegments = index + 1
          } catch (playError) {
            await pending
            throw playError
          }
        }
      }
    } catch (e) {
      if (controller.signal.aborted || speechSessionRef.current !== session) return
      if (playbackMode === 'studio' && completedSegments < segments.length) {
        setVoiceStatus('Studio unavailable · continuing with Fast')
        try {
          await speakFast(completedSegments)
        } catch (fallbackError) {
          if (!(fallbackError instanceof DOMException && fallbackError.name === 'AbortError')) {
            setError(formatVeniceError(fallbackError))
          }
        }
      } else if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(formatVeniceError(e))
      }
    } finally {
      if (speechSessionRef.current === session) {
        speechAbortRef.current = null
        setSpeakingId(null)
        setVoiceStatus(null)
      }
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
    const shouldAutoSpeak = options.autoSpeak ?? speakReplies
    setError(null)
    setInput('')
    stopVoice()
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

    if (shouldAutoSpeak && spokenReply.trim() && !controller.signal.aborted) {
      void speak(pendingMsg.id, spokenReply, effectiveLanguageMode)
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
      setLanguageMode('dual-dialect')
      await send(result.text, { languageMode: mode })
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
          <div className="ambient-mesh flex flex-col gap-3 pt-5">
            <div className="relative flex flex-col items-center gap-3 pb-1 pt-2 text-center">
              <div className="relative h-20 w-20 shrink-0">
                <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[var(--color-accent)]/25 blur-xl" />
                <div className="relative h-full w-full overflow-hidden rounded-full border border-white/[0.14] shadow-[var(--shadow-2)]">
                  <img src="/nour-portrait.png" alt="" className="h-full w-full object-cover object-[50%_18%]" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[17px] font-semibold tracking-[-0.01em] text-white">{NOUR_NAME}</span>
                  <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">{NOUR_AGE} · Adult</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-white/45">{NOUR_TAGLINE}</div>
              </div>
              <div className="text-[15px] font-semibold text-white/85">Tell me what you want done.</div>
              <p className="max-w-[34ch] text-[13px] leading-relaxed text-white/45">
                Chat naturally or use the mic below — English or Egyptian. Noor can read every reply aloud and run your tools.
              </p>
            </div>
            <div className="relative flex flex-col gap-2">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { haptic('select'); void send(p) }}
                  className="min-h-11 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-left text-[13px] text-white/70 shadow-[var(--shadow-1)] transition-all hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
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
                    'max-w-[90%] min-w-0 break-words [overflow-wrap:anywhere] px-3.5 py-2.5 rounded-xl text-[15px] leading-[1.6] whitespace-pre-wrap sm:max-w-[88%]',
                    m.role === 'user'
                      ? 'bg-white/[0.10] text-white border border-white/[0.06] shadow-[var(--shadow-1)]'
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
                    className="min-h-11 inline-flex items-center gap-1.5 px-3 rounded-lg text-[12px] font-medium text-white/55 hover:text-white/90 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    {speakingId === m.id ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><rect width="8" height="8" rx="1" /></svg>
                        {voiceStatus || 'Stop'}
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        Play voice
                      </>
                    )}
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

      <div className="max-w-full min-w-0 shrink-0 overflow-x-hidden border-t border-white/[0.06] px-3 pt-2 pb-[max(0.75rem,var(--keyboard-inset,0px))]">
        <button
          type="button"
          onClick={() => { haptic('tap'); setSessionOpen(true) }}
          aria-haspopup="dialog"
          className="mb-2 flex max-w-full min-h-9 items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-[11.5px] font-medium text-white/60 transition-colors hover:border-white/[0.2] hover:text-white/90"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="truncate">
            {NOUR_LANGUAGE_LABEL} · {speakReplies ? 'auto-read on' : 'auto-read off'} · {playbackMode === 'fast' ? 'fast voice' : `studio · ${NOUR_TTS_VOICE}`}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {error && <div role="alert" className="mb-2 break-words [overflow-wrap:anywhere] text-[13px] text-red-300/95">{error}</div>}
        <div className="flex max-w-full min-w-0 items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                haptic('tap')
                void send(input)
              }
            }}
            placeholder={isThinking ? 'Noor is working…' : 'Message Noor or ask her to create something…'}
            rows={2}
            disabled={isThinking || Boolean(listeningLocale)}
            aria-label="Message Noor"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white/90 shadow-[var(--shadow-1)] outline-none placeholder:text-white/30 transition-colors focus:border-white/[0.22] disabled:opacity-60"
          />
          <button
            type="button"
            disabled={isThinking}
            onClick={() => { haptic('tap'); void listenAndSend('en-US') }}
            aria-label={listeningLocale ? 'Stop listening' : 'Microphone · English + Egyptian'}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40',
              listeningLocale
                ? 'border-white/[0.2] bg-white text-black'
                : 'border-white/[0.09] bg-white/[0.04] text-white/70 hover:text-white',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0M12 17v5M8 22h8" />
            </svg>
          </button>
          {isThinking ? (
            <button
              onClick={cancel}
              className="shrink-0 min-h-11 px-3 py-2 text-[13px] text-white/85 hover:text-white border border-white/[0.12] hover:bg-white/[0.05] rounded-xl transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => { haptic('tap'); void send(input) }}
              disabled={!input.trim() || !hasKey || agentModelsLoading || !activeAgentModel || Boolean(listeningLocale)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-black shadow-[var(--shadow-1)] transition-transform hover:bg-white/92 active:scale-95 disabled:bg-white/[0.07] disabled:text-white/25 disabled:shadow-none"
              aria-label="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        <BottomSheet open={sessionOpen} onClose={() => setSessionOpen(false)} title="Voice session">
          <div className="flex flex-col gap-4 pt-1">
            <div className="text-[13px] text-white/50">Dialect: English + Egyptian Arabic — fixed. Noor does not switch modes.</div>
            <div>
              <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#c6beb5]">Voice engine</div>
              <SegmentedControl
                ariaLabel="Voice playback mode"
                options={[
                  { value: 'fast' as const, label: 'Fast · device' },
                  { value: 'studio' as const, label: `Studio · ${NOUR_TTS_VOICE}` },
                ]}
                value={playbackMode}
                onChange={(mode) => { haptic('select'); stopVoice(); setPlaybackMode(mode) }}
              />
            </div>
            <button
              type="button"
              onClick={() => { haptic('select'); if (speakReplies) stopVoice(); setSpeakReplies(!speakReplies) }}
              aria-pressed={speakReplies}
              className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 py-2.5 text-left text-[14px] text-white/80 transition-colors hover:border-white/[0.18]"
            >
              <span>
                <span className="font-medium">Auto-read replies</span>
                <span className="mt-0.5 block text-[12px] text-white/40">Noor speaks every answer aloud</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                  speakReplies ? 'bg-[var(--color-accent)]/85' : 'bg-white/[0.14]',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                    speakReplies ? 'left-[1.125rem]' : 'left-0.5',
                  )}
                />
              </span>
            </button>
            <p className="text-[12px] leading-relaxed text-white/35">
              Studio voice renders through the Omnia model for richer playback; Fast uses the on-device speech engine.
            </p>
          </div>
        </BottomSheet>

        {listeningLocale && (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 bg-[#0a0a0c]/95 animate-fade-in" role="status" aria-live="polite">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <span aria-hidden="true" className="absolute inset-0 rounded-full border border-[var(--color-accent)]/40 animate-voice-ring" />
              <span aria-hidden="true" className="absolute inset-0 rounded-full border border-[var(--color-accent)]/30 animate-voice-ring" style={{ animationDelay: '0.8s' }} />
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/[0.15] shadow-[var(--shadow-3)]">
                <img src="/nour-portrait.png" alt="" className="h-full w-full object-cover object-[50%_18%]" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-[17px] font-semibold text-white/90">Listening…</div>
              <div className="mt-1 text-[13px] text-white/45">{listeningLocale === 'ar-EG' ? 'اتكلم بحرية — Egyptian Arabic' : 'Speak naturally — English'}</div>
            </div>
            <button
              type="button"
              onClick={() => { haptic('warn'); void listenAndSend(listeningLocale) }}
              className="min-h-12 rounded-full border border-white/[0.14] px-6 text-[14px] font-medium text-white/75 transition-colors hover:border-white/[0.3] hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
