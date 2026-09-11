import { describe, expect, it } from 'vitest'
import type { ConnectorHttpTransport, HttpRequestOptions, SseMessage, BinaryHttpResponse } from '../http-transport'
import { LocalDreamConnector } from './localdream-connector'

class ScriptedTransport implements ConnectorHttpTransport {
  readonly calls: Array<{ url: string; options?: HttpRequestOptions }> = []
  private readonly responses: Record<string, unknown>
  constructor(responses: Record<string, unknown>) {
    this.responses = responses
  }
  async requestJson<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    this.calls.push({ url, options })
    const key = Object.keys(this.responses).find((candidate) => url.includes(candidate))
    if (!key) throw new Error(`unexpected url ${url}`)
    const payload = this.responses[key]
    if (payload instanceof Error) throw payload
    return payload as T
  }
  requestBinary(): Promise<BinaryHttpResponse> {
    throw new Error('not implemented')
  }
  async *requestSse(): AsyncGenerator<SseMessage, void, void> {}
}

describe('LocalDreamConnector.ensureReady', () => {
  it('is not ready when the host has no downloaded generation models', async () => {
    const transport = new ScriptedTransport({
      '/info': { app: 'Local Dream', protocol: 1, version: '2.8.1', device: 'phone' },
      '/models': { use_img2img: true, models: [], upscalers: [] },
      '/status': { state: 'idle' },
    })
    const connector = new LocalDreamConnector({ transport })
    const state = await connector.ensureReady()
    expect(state.ready).toBe(false)
    expect(state.models).toEqual([])
    expect(state.nextStep).toMatch(/Local Dream/)
  })

  it('is ready when at least one model is already on the device', async () => {
    const transport = new ScriptedTransport({
      '/info': { app: 'Local Dream', protocol: 1, version: '2.8.1', device: 'phone' },
      '/models': {
        use_img2img: true,
        models: [{ id: 'anythingv5', name: 'Anything V5.0', run_on_cpu: false, is_sdxl: false, is_anima: true, is_custom: false, generation_size: 512, defaults: { prompt: '', negative_prompt: '', steps: 20, cfg: 7, scheduler: 'euler' }, resolutions: [[512, 512]] }],
        upscalers: [{ id: '4x', path: '/upscalers/4x.mnn' }],
      },
      '/status': { state: 'idle' },
    })
    const connector = new LocalDreamConnector({ transport })
    const state = await connector.ensureReady()
    expect(state.ready).toBe(true)
    expect(state.models).toEqual(['anythingv5'])
    expect(state.nextStep).toMatch(/select_model/)
  })
})
