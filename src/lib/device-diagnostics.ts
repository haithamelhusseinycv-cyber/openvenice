import { LocalDreamConnector } from '../connectors/localdream/localdream-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'

export type DiagnosticStatus = 'pass' | 'warn' | 'fail'

export interface DiagnosticResult {
  id: 'platform' | 'qwen' | 'localdream' | 'facefusion' | 'voice' | 'storage'
  label: string
  status: DiagnosticStatus
  detail: string
}

export interface QwenDiagnosticConfig {
  baseUrl: string
  modelId: string
  apiKey?: string
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

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
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
    status: native ? 'pass' : 'warn',
    detail: native ? `Native Android · ${platform}` : `Browser/PWA · ${platform}`,
  }
}

export async function checkQwen(config: QwenDiagnosticConfig): Promise<DiagnosticResult> {
  const baseUrl = config.baseUrl.trim()
  const modelId = config.modelId.trim()
  if (!baseUrl || !modelId) {
    return {
      id: 'qwen',
      label: 'Private Qwen',
      status: 'fail',
      detail: 'Base URL or model ID is not configured.',
    }
  }

  try {
    const response = await withTimeout((signal) => fetch(joinUrl(baseUrl, '/models'), {
      method: 'GET',
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      signal,
    }))

    if (response.ok) {
      return {
        id: 'qwen',
        label: 'Private Qwen',
        status: 'pass',
        detail: `Reachable · ${modelId}`,
      }
    }

    if (response.status === 404 || response.status === 405) {
      return {
        id: 'qwen',
        label: 'Private Qwen',
        status: 'warn',
        detail: `Configured · ${modelId} · server does not expose GET /models`,
      }
    }

    return {
      id: 'qwen',
      label: 'Private Qwen',
      status: 'fail',
      detail: `Endpoint returned HTTP ${response.status}.`,
    }
  } catch (error) {
    return {
      id: 'qwen',
      label: 'Private Qwen',
      status: 'fail',
      detail: `Connection failed · ${compactError(error)}`,
    }
  }
}

export async function checkLocalDream(): Promise<DiagnosticResult> {
  const connector = new LocalDreamConnector()
  try {
    const info = await withTimeout((signal) => connector.info(signal), 3000)
    return {
      id: 'localdream',
      label: 'Local Dream',
      status: 'pass',
      detail: `${info.version || 'host'} · ${info.device || 'device'} · 127.0.0.1`,
    }
  } catch (error) {
    return {
      id: 'localdream',
      label: 'Local Dream',
      status: 'warn',
      detail: `Host API not reachable · ${compactError(error)}`,
    }
  }
}

export async function checkFaceFusion(): Promise<DiagnosticResult> {
  if (!isNativeOpenVeniceAndroid()) {
    return {
      id: 'facefusion',
      label: 'FaceFusion',
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
        label: 'FaceFusion',
        status: 'warn',
        detail: 'Bridge present, but the FaceFusion companion is unavailable.',
      }
    }

    const catalog = await withTimeout(() => connector.listModels(), 4000)
    return {
      id: 'facefusion',
      label: 'FaceFusion',
      status: 'pass',
      detail: `Connected · ${catalog.swappers.length} swapper${catalog.swappers.length === 1 ? '' : 's'} · ${catalog.faceEnhancers.length} face enhancer${catalog.faceEnhancers.length === 1 ? '' : 's'}`,
    }
  } catch (error) {
    return {
      id: 'facefusion',
      label: 'FaceFusion',
      status: 'fail',
      detail: `Bridge check failed · ${compactError(error)}`,
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
      label: 'Voice chat',
      status: 'pass',
      detail: 'Native Android speech bridge available · en-US + ar-EG',
    }
  }

  if (browserRecognition && browserTts) {
    return {
      id: 'voice',
      label: 'Voice chat',
      status: 'warn',
      detail: 'Browser speech fallback available · native Android bridge not active',
    }
  }

  return {
    id: 'voice',
    label: 'Voice chat',
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

export async function runDeviceDiagnostics(qwen: QwenDiagnosticConfig): Promise<DiagnosticResult[]> {
  const immediate = [checkPlatform(), checkVoice(), checkStorage()]
  const [qwenResult, localDreamResult, faceFusionResult] = await Promise.all([
    checkQwen(qwen),
    checkLocalDream(),
    checkFaceFusion(),
  ])
  return [immediate[0], qwenResult, localDreamResult, faceFusionResult, immediate[1], immediate[2]]
}
