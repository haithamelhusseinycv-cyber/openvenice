import { LocalDreamConnector } from '../connectors/localdream/localdream-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { isAllowedChatModel, isAllowedImageModel } from './allowed-models'
import { veniceWithTimeout } from './venice-client'
import type { ModelsResponse } from '../types/venice'

export type DiagnosticStatus = 'pass' | 'warn' | 'fail'

export interface DiagnosticResult {
  id: 'platform' | 'venice' | 'localdream' | 'facefusion' | 'voice' | 'storage'
  label: string
  status: DiagnosticStatus
  detail: string
}

export async function checkVeniceModels(): Promise<DiagnosticResult> {
  try {
    const [text, image] = await Promise.all([
      veniceWithTimeout<ModelsResponse>('/models?type=text', 8_000),
      veniceWithTimeout<ModelsResponse>('/models?type=image', 8_000),
    ])
    const textModels = text.data.filter((model) => !model.model_spec?.offline && isAllowedChatModel(model.id))
    const imageModels = image.data.filter((model) => !model.model_spec?.offline && isAllowedImageModel(model.id))
    const ready = textModels.length > 0 && imageModels.length > 0
    return {
      id: 'venice',
      label: 'Venice API and models',
      status: ready ? 'pass' : 'fail',
      detail: ready
        ? `Authenticated · ${textModels.length} Noor text model${textModels.length === 1 ? '' : 's'} · ${imageModels.length} image model${imageModels.length === 1 ? '' : 's'}`
        : `Catalog loaded, but compatible models are missing · text ${textModels.length} · image ${imageModels.length}`,
    }
  } catch (error) {
    return {
      id: 'venice',
      label: 'Venice API and models',
      status: 'fail',
      detail: compactError(error),
    }
  }
}

function compactError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Timed out'
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = 4500) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await work(controller.signal)
  } finally {
    window.clearTimeout(timer)
  }
}

export function checkPlatform(): DiagnosticResult {
  const native = isNativeOpenVeniceAndroid()
  const runtime = typeof window !== 'undefined'
    ? (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
    : undefined
  const platform = runtime?.getPlatform?.() || (native ? 'android' : 'web')

  return {
    id: 'platform',
    label: 'OpenVenice runtime',
    status: 'pass',
    detail: native ? `Native Android · ${platform}` : `Browser/PWA runtime ready · ${platform}`,
  }
}

export async function checkLocalDream(): Promise<DiagnosticResult> {
  const connector = new LocalDreamConnector()
  try {
    const info = await withTimeout((signal) => connector.info(signal), 3000)
    return {
      id: 'localdream',
      label: 'Local Dream · optional',
      status: 'pass',
      detail: `${info.version || 'host'} · ${info.device || 'device'} · 127.0.0.1`,
    }
  } catch (error) {
    return {
      id: 'localdream',
      label: 'Local Dream · optional',
      status: 'warn',
      detail: `Not currently connected · ${compactError(error)}`,
    }
  }
}

export async function checkFaceFusion(): Promise<DiagnosticResult> {
  if (!isNativeOpenVeniceAndroid()) {
    return {
      id: 'facefusion',
      label: 'FaceFusion · optional',
      status: 'warn',
      detail: 'Native Android bridge is unavailable in browser/PWA mode.',
    }
  }

  try {
    const connector = new FaceFusionConnector(new CapacitorFaceFusionBridge())
    const available = await withTimeout(() => connector.isAvailable(), 3000)
    if (!available) {
      return {
        id: 'facefusion',
        label: 'FaceFusion · optional',
        status: 'warn',
        detail: 'Bridge is present; install or start the matching FaceFusion companion to enable it.',
      }
    }

    const catalog = await withTimeout(() => connector.listModels(), 4000)
    return {
      id: 'facefusion',
      label: 'FaceFusion · optional',
      status: 'pass',
      detail: `Connected · ${catalog.swappers.length} swapper${catalog.swappers.length === 1 ? '' : 's'} · ${catalog.faceEnhancers.length} face enhancer${catalog.faceEnhancers.length === 1 ? '' : 's'}`,
    }
  } catch (error) {
    return {
      id: 'facefusion',
      label: 'FaceFusion · optional',
      status: 'warn',
      detail: `Companion check unavailable · ${compactError(error)}`,
    }
  }
}

export function checkVoice(): DiagnosticResult {
  const runtime = typeof window !== 'undefined'
    ? (window as unknown as { Capacitor?: { isPluginAvailable?: (name: string) => boolean } }).Capacitor
    : undefined
  const native = isNativeOpenVeniceAndroid()
  const nativePlugin = native && (runtime?.isPluginAvailable?.('VoiceChat') ?? true)
  const browserRecognition = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const browserTts = typeof window !== 'undefined' && Boolean(window.speechSynthesis)

  if (nativePlugin) {
    return {
      id: 'voice',
      label: 'Noor voice commands',
      status: 'pass',
      detail: 'Native Android speech bridge available · English en-US + Egyptian Arabic ar-EG',
    }
  }

  if (browserRecognition && browserTts) {
    return {
      id: 'voice',
      label: 'Noor voice commands',
      status: 'pass',
      detail: 'Browser microphone and fast device speech available',
    }
  }

  if (browserTts) {
    return {
      id: 'voice',
      label: 'Noor voice output',
      status: 'warn',
      detail: 'Fast device speech is available; browser microphone recognition is unavailable.',
    }
  }

  return {
    id: 'voice',
    label: 'Noor voice commands',
    status: 'fail',
    detail: 'Speech recognition or text-to-speech is unavailable.',
  }
}

export function checkStorage(): DiagnosticResult {
  try {
    const key = '__openvenice_diagnostic__'
    localStorage.setItem(key, 'ok')
    const ok = localStorage.getItem(key) === 'ok'
    localStorage.removeItem(key)
    return {
      id: 'storage',
      label: 'Local storage',
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'Read/write check passed.' : 'Read/write check did not persist.',
    }
  } catch (error) {
    return {
      id: 'storage',
      label: 'Local storage',
      status: 'fail',
      detail: compactError(error),
    }
  }
}

export async function runDeviceDiagnostics(): Promise<DiagnosticResult[]> {
  const immediate = [checkPlatform(), checkVoice(), checkStorage()]
  const [veniceResult, localDreamResult, faceFusionResult] = await Promise.all([
    checkVeniceModels(),
    checkLocalDream(),
    checkFaceFusion(),
  ])
  return [immediate[0], veniceResult, immediate[1], immediate[2], localDreamResult, faceFusionResult]
}
