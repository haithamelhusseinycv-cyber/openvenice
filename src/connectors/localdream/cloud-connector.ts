/** Independent cloud image channel, sharing Easy's durable gateway. */
export type CloudOperation = 'auto' | 'create' | 'edit' | 'combine' | 'masked_edit' | 'remove_background' | 'upscale' | 'face_detailer' | 'mask'
export interface CloudRequest {
  prompt: string
  operation: CloudOperation
  image?: string
  references?: string[]
  target?: string
  max_cost_usd?: number
}
export interface CloudJob {
  id: string
  state: 'queued' | 'planning' | 'processing' | 'reviewing' | 'complete' | 'needs_review' | 'needs_input' | 'failed' | 'cancelled'
  message: string
  images: Array<{ filename: string }>
  estimated_cost_usd?: number
  review?: { passed: boolean; issues: string[] }
}
export interface CloudVersion { id: string; role: string; filename: string; url: string }
type Persistence = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Pending = { body: CloudRequest & { token: string; quality: 'high'; speed: 'quality' }; id?: string; cancelRequested?: boolean; cancelConfirmed?: boolean }
const KEY = 'localdream.cloud.pending.v2'
const TERMINAL = new Set(['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'])

export type CloudWsEvent = {
  type: 'job_update' | 'gpu_status' | 'progress'
  job_id?: string
  state?: string
  message?: string
  progress?: number
  updated?: number
  [key: string]: unknown
}
type WsListener = (event: CloudWsEvent) => void

export class LocalDreamCloudConnector {
  readonly base = 'http://127.0.0.1:8298'
  private readonly storage: Persistence
  private readonly fetcher: typeof fetch
  private ws: WebSocket | null = null
  private wsListeners = new Set<WsListener>()
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private wsClosed = false
  constructor(storage: Persistence, fetcher: typeof fetch = fetch) { this.storage = storage; this.fetcher = fetcher }
  private async request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.fetcher(this.base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal,
    })
    const value = await response.json() as T & { error?: string }
    if (!response.ok) throw new Error(value.error || 'Local Dream cloud request failed')
    return value
  }
  capabilities(signal?: AbortSignal) {
    return this.request<{ protocol: number; profile: string; cancel_by_token: boolean; operations: Array<{ id: CloudOperation; acceptance: string }> }>('/api/capabilities', undefined, signal)
  }
  async upload(base64: string, signal?: AbortSignal) {
    return this.request<{ filename: string; width: number; height: number }>('/api/upload', { image: base64 }, signal)
  }
  pending(): Pending | undefined {
    const stored = this.storage.getItem(KEY)
    return stored ? JSON.parse(stored) as Pending : undefined
  }
  async submit(input: CloudRequest, signal?: AbortSignal): Promise<CloudJob> {
    const existing = this.pending()
    if (existing) throw new Error('Reconnect to the existing cloud job before submitting another.')
    const capabilities = await this.capabilities(signal)
    if (capabilities.protocol !== 2 || capabilities.profile !== 'Best' || !capabilities.cancel_by_token || !capabilities.operations.some((op) => op.id === input.operation)) {
      throw new Error('The gateway does not support this Best workflow.')
    }
    const pending: Pending = { body: { ...input, token: crypto.randomUUID().replaceAll('-', ''), quality: 'high', speed: 'quality' } }
    this.storage.setItem(KEY, JSON.stringify(pending)) // Persist BEFORE the paid submission.
    return this.reconnect(signal)
  }
  async reconnect(signal?: AbortSignal): Promise<CloudJob> {
    const pending = this.pending()
    if (!pending) throw new Error('No pending cloud request')
    if (pending.cancelRequested && !pending.cancelConfirmed) return this.cancel(signal)
    if (pending.cancelConfirmed && !pending.id) return { id: '', state: 'cancelled', message: 'Cancelled before acceptance', images: [] }
    // A lost POST response is retried only with the SAME durable idempotency token.
    const job = pending.id
      ? await this.request<CloudJob>('/api/jobs/' + pending.id, undefined, signal)
      : await this.request<CloudJob>('/api/jobs', pending.body, signal)
    const latest = this.pending()
    if (!latest || latest.body.token !== pending.body.token) throw new Error('The pending request changed while reconnecting.')
    this.storage.setItem(KEY, JSON.stringify({ ...latest, id: job.id }))
    return job
  }
  async cancel(signal?: AbortSignal) {
    const pending = this.pending()
    if (!pending) throw new Error('No pending cloud request')
    this.storage.setItem(KEY, JSON.stringify({ ...pending, cancelRequested: true }))
    const result = await this.request<{ cancelled: boolean; job_id: string | null }>('/api/cancel-token', { token: pending.body.token }, signal)
    if (!result.cancelled) throw new Error('Cancellation was not confirmed')
    this.storage.setItem(KEY, JSON.stringify({ ...pending, id: result.job_id ?? pending.id, cancelRequested: true, cancelConfirmed: true }))
    return this.reconnect(signal)
  }
  async resume(id: string, signal?: AbortSignal) {
    return this.request<CloudJob>('/api/jobs/' + id + '/resume', {}, signal)
  }
  versions(id: string, signal?: AbortSignal) {
    return this.request<{ versions: CloudVersion[]; selected?: string }>('/api/jobs/' + id + '/versions', undefined, signal)
  }
  selectVersion(id: string, version: string, signal?: AbortSignal) {
    return this.request<CloudVersion>('/api/jobs/' + id + '/select-version', { version }, signal)
  }
  async acknowledge(): Promise<void> {
    const job = await this.reconnect()
    if (!TERMINAL.has(job.state)) throw new Error('The cloud job is still active.')
    this.storage.removeItem(KEY)
  }
  connectWebSocket(): void {
    if (this.ws || typeof WebSocket === 'undefined') return
    this.wsClosed = false
    const ws = new WebSocket('ws://127.0.0.1:8299')
    this.ws = ws
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'subscribe', channels: ['job_update', 'gpu_status', 'progress'] })) }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as CloudWsEvent
        for (const listener of this.wsListeners) listener(data)
      } catch { /* ignore malformed frames */ }
    }
    ws.onclose = () => {
      this.ws = null
      if (!this.wsClosed) this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 3000)
    }
    ws.onerror = () => { try { ws.close() } catch { /* already closing */ } }
  }
  disconnectWebSocket(): void {
    this.wsClosed = true
    if (this.wsReconnectTimer) { clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null }
    if (this.ws) { try { this.ws.close() } catch { /* already closing */ } this.ws = null }
  }
  onWebSocketEvent(listener: WsListener): () => void {
    this.wsListeners.add(listener)
    if (!this.ws) this.connectWebSocket()
    return () => { this.wsListeners.delete(listener); if (this.wsListeners.size === 0) this.disconnectWebSocket() }
  }
}
