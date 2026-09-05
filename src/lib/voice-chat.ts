export type VoiceLocale = 'en-US' | 'ar-EG'

export interface VoiceRecognitionResult {
  text: string
  locale: VoiceLocale
  confidence?: number
  cancelled?: boolean
}

interface CapacitorVoiceRuntime {
  getPlatform?: () => string
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise?: (pluginName: string, methodName: string, options: Record<string, unknown>) => Promise<unknown>
  Plugins?: Record<string, Record<string, (options?: Record<string, unknown>) => Promise<unknown>>>
}

declare global {
  interface Window {
    Capacitor?: CapacitorVoiceRuntime
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<{ 0?: { transcript?: string; confidence?: number } }>
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string
}

interface BrowserSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition
}

let browserRecognizer: BrowserSpeechRecognition | null = null

function nativeRuntime() {
  return typeof window !== 'undefined' ? window.Capacitor : undefined
}

function isNativeAndroid() {
  const runtime = nativeRuntime()
  if (!runtime) return false
  if (typeof runtime.isNativePlatform === 'function') return runtime.isNativePlatform()
  return runtime.getPlatform?.() === 'android'
}

async function invokeNative<T>(method: string, options: Record<string, unknown> = {}): Promise<T> {
  const runtime = nativeRuntime()
  if (!runtime || !isNativeAndroid()) throw new Error('Native voice bridge is unavailable')

  if (runtime.isPluginAvailable && !runtime.isPluginAvailable('VoiceChat')) {
    throw new Error('VoiceChat native plugin is unavailable')
  }

  if (typeof runtime.nativePromise === 'function') {
    return await runtime.nativePromise('VoiceChat', method, options) as T
  }

  const plugin = runtime.Plugins?.VoiceChat
  const fn = plugin?.[method]
  if (!fn) throw new Error(`VoiceChat native method is unavailable: ${method}`)
  return await fn(options) as T
}

function recognitionConstructor() {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

export function voiceLocaleLabel(locale: VoiceLocale) {
  return locale === 'ar-EG' ? 'Egyptian Arabic' : 'English'
}

export function voiceLocaleShortLabel(locale: VoiceLocale) {
  return locale === 'ar-EG' ? 'مصري' : 'EN'
}

export async function listenForVoice(locale: VoiceLocale): Promise<VoiceRecognitionResult> {
  if (isNativeAndroid()) {
    return await invokeNative<VoiceRecognitionResult>('listen', { locale })
  }

  const Recognition = recognitionConstructor()
  if (!Recognition) throw new Error('Speech recognition is not available in this browser')
  if (browserRecognizer) browserRecognizer.abort()

  return await new Promise<VoiceRecognitionResult>((resolve, reject) => {
    const recognizer = new Recognition()
    browserRecognizer = recognizer
    recognizer.lang = locale
    recognizer.continuous = false
    recognizer.interimResults = false
    recognizer.maxAlternatives = 3
    let settled = false

    const cleanup = () => {
      if (browserRecognizer === recognizer) browserRecognizer = null
      recognizer.onresult = null
      recognizer.onerror = null
      recognizer.onend = null
    }

    recognizer.onresult = (event) => {
      if (settled) return
      settled = true
      const best = event.results?.[0]?.[0]
      const text = best?.transcript?.trim() || ''
      cleanup()
      if (!text) {
        reject(new Error('No speech was recognized'))
        return
      }
      resolve({ text, locale, confidence: best?.confidence })
    }

    recognizer.onerror = (event) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(`Speech recognition failed${event.error ? `: ${event.error}` : ''}`))
    }

    recognizer.onend = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Speech recognition ended without a result'))
    }

    try {
      recognizer.start()
    } catch (error) {
      settled = true
      cleanup()
      reject(error)
    }
  })
}

export async function cancelVoiceListening() {
  if (isNativeAndroid()) {
    await invokeNative('cancelListening').catch(() => undefined)
    return
  }
  browserRecognizer?.abort()
  browserRecognizer = null
}

function normalizeSpeechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_>#~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface SpeakVoiceOptions {
  rate?: number
  pitch?: number
  signal?: AbortSignal
  /** When false, queues after any already-speaking/queued utterance instead of cancelling it. */
  interrupt?: boolean
}

async function speakVoiceInternal(text: string, locale: VoiceLocale, options: SpeakVoiceOptions) {
  const clean = normalizeSpeechText(text)
  if (!clean) return
  if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')

  if (isNativeAndroid()) {
    await invokeNative('speak', {
      text: clean,
      locale,
      rate: options.rate ?? 1,
      pitch: options.pitch ?? 1,
    })
    return
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('Text-to-speech is not available in this browser')
  }

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = locale
    utterance.rate = options.rate ?? 1
    utterance.pitch = options.pitch ?? 1
    const cleanup = () => options.signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      window.speechSynthesis.cancel()
      cleanup()
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    utterance.onend = () => { cleanup(); resolve() }
    utterance.onerror = () => { cleanup(); reject(new Error('Text-to-speech failed')) }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.interrupt !== false) window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

export async function speakVoice(
  text: string,
  locale: VoiceLocale,
  options: { rate?: number; pitch?: number; signal?: AbortSignal } = {},
) {
  await speakVoiceInternal(text, locale, { ...options, interrupt: true })
}

/**
 * Speaks text without cancelling any utterance already speaking/queued. Only meaningful for the
 * browser Web Speech API, which natively queues sequential `speak()` calls; use this to read a
 * streaming reply incrementally (sentence-by-sentence) instead of waiting for it to finish.
 * Falls back to native Android speech (which is not queue-safe) unchanged, so callers should gate
 * progressive use with `isBrowserSpeechAvailable()`.
 */
export async function queueVoiceChunk(
  text: string,
  locale: VoiceLocale,
  options: { rate?: number; pitch?: number; signal?: AbortSignal } = {},
) {
  await speakVoiceInternal(text, locale, { ...options, interrupt: false })
}

/** True when progressive (queued) speech via the browser Web Speech API is usable. */
export function isBrowserSpeechAvailable() {
  return !isNativeAndroid() && typeof window !== 'undefined' && !!window.speechSynthesis
}

/**
 * Splits the given text into complete sentences (ending in ./!/?/؟) and reports how many
 * characters were consumed, so a caller streaming text incrementally can speak finished sentences
 * as soon as they appear and know where to resume from for the next call.
 */
export function extractCompleteSentences(text: string): { chunks: string[]; consumed: number } {
  const chunks: string[] = []
  let consumed = 0
  const regex = /[^.!?؟]*[.!?؟]+(?=\s|$)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const sentence = match[0].trim()
    if (sentence) chunks.push(sentence)
    consumed = match.index + match[0].length
  }
  return { chunks, consumed }
}

export async function stopVoiceSpeaking() {
  if (isNativeAndroid()) {
    await invokeNative('stopSpeaking').catch(() => undefined)
    return
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}
