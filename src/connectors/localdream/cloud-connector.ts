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
type Pending = { body: CloudRequest & { token: string; quality: 'high'; speed: 'quality' }; id?: string }
const KEY = 'localdream.cloud.pending.v2'
const TERMINAL = new Set(['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'])

export class LocalDreamCloudConnector {
  readonly base = 'http://127.0.0.1:8298'
  private readonly storage: Persistence
  private readonly fetcher: typeof fetch
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
    return this.request<{ protocol: number; profile: string; operations: Array<{ id: CloudOperation; acceptance: string }> }>('/api/capabilities', undefined, signal)
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
    if (capabilities.protocol !== 2 || capabilities.profile !== 'Best' || !capabilities.operations.some((op) => op.id === input.operation)) {
      throw new Error('The gateway does not support this Best workflow.')
    }
    const pending: Pending = { body: { ...input, token: crypto.randomUUID().replaceAll('-', ''), quality: 'high', speed: 'quality' } }
    this.storage.setItem(KEY, JSON.stringify(pending)) // Persist BEFORE the paid submission.
    return this.reconnect(signal)
  }
  async reconnect(signal?: AbortSignal): Promise<CloudJob> {
    const pending = this.pending()
    if (!pending) throw new Error('No pending cloud request')
    // A lost POST response is retried only with the SAME durable idempotency token.
    const job = pending.id
      ? await this.request<CloudJob>('/api/jobs/' + pending.id, undefined, signal)
      : await this.request<CloudJob>('/api/jobs', pending.body, signal)
    pending.id = job.id
    this.storage.setItem(KEY, JSON.stringify(pending))
    return job
  }
  async cancel(signal?: AbortSignal) {
    const job = await this.reconnect(signal)
    return this.request<CloudJob>('/api/jobs/' + job.id + '/cancel', {}, signal)
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
}
