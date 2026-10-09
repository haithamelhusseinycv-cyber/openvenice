import { browserStorage } from '../lib/browser-storage'
import type { RoutingDecision } from '../agent/intelligent-router'
import { veniceImageAPI } from '../lib/venice-image-api'
import { enqueueGeneration, getQueuedGenerations, dequeueGeneration, incrementRetryCount } from '../lib/offline-queue'
import { saveGeneratedImage } from '../lib/image-persistence'
import { LocalDreamCloudConnector, type CloudOperation } from '../connectors/localdream/cloud-connector'
import { useAuthStore } from '../stores/auth-store'
import { useSettingsStore } from '../stores/settings-store'

export type JobStatus = 'idle' | 'queued' | 'routing' | 'starting' | 'running' | 'completed' | 'failed'
export interface GenerationJob {
  id: string; status: JobStatus; provider: 'venice' | 'local-dream' | 'atelier'
  prompt: string; enhancedPrompt: string; route: RoutingDecision; progress: number; message: string
  jobId?: string; imageUrl?: string; error?: string; createdAt: number; updatedAt: number
}
export interface StartGenerationParams { prompt: string; enhancedPrompt: string; route: RoutingDecision; inputImages?: string[] }
type JobListener = (job: GenerationJob | null) => void
const JOB_KEY = 'chilli.generation.current.v1'
const ACTIVE = new Set<JobStatus>(['starting', 'running', 'routing'])
export class GenerationExecutor {
  private currentJob: GenerationJob | null = null
  private listeners = new Set<JobListener>()
  private controller: AbortController | null = null
  private processingQueue = false
  constructor() {
    try {
      const saved = JSON.parse(browserStorage.getItem(JOB_KEY) || 'null') as GenerationJob | null
      if (saved?.id && saved?.route) {
        this.currentJob = saved
        if (ACTIVE.has(saved.status)) this.currentJob = { ...saved, status: 'failed', message: saved.provider === 'local-dream' ? 'Interrupted. Reconnect in Local Dream Cloud to recover this job.' : 'Interrupted. Check the image library before submitting again; the provider may have completed it.', error: 'Request interrupted by app restart' }
      }
    } catch { browserStorage.removeItem(JOB_KEY) }
  }
  private notify() {
    if (this.currentJob) {
      const saved = { ...this.currentJob, imageUrl: undefined }
      browserStorage.setItem(JOB_KEY, JSON.stringify(saved))
    } else browserStorage.removeItem(JOB_KEY)
    this.listeners.forEach(listener => listener(this.currentJob))
  }
  subscribe(listener: JobListener) { this.listeners.add(listener); listener(this.currentJob); return () => { this.listeners.delete(listener) } }
  private updateJob(updates: Partial<GenerationJob>) {
    if (!this.currentJob) return
    this.currentJob = { ...this.currentJob, ...updates, updatedAt: Date.now() }
    this.notify()
  }
  async startGeneration(params: StartGenerationParams): Promise<GenerationJob> {
    if (this.currentJob && ACTIVE.has(this.currentJob.status)) throw new Error('Wait for the active generation to finish')
    const now = Date.now()
    this.currentJob = { id: crypto.randomUUID(), status: 'starting', provider: 'venice', prompt: params.prompt,
      enhancedPrompt: params.enhancedPrompt, route: params.route, progress: 0, message: 'Starting', createdAt: now, updatedAt: now }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueGeneration(params)
      this.updateJob({ status: 'queued', message: 'Saved offline. Reconnect to run this request.' })
      return this.currentJob
    }
    this.controller = new AbortController()
    this.notify()
    try {
      const operation = params.route.operation
      let imageUrl: string
      let completedCloud: LocalDreamCloudConnector | undefined
      if (['masked_edit', 'face_detailer', 'mask'].includes(operation)) {
        this.updateJob({ provider: 'local-dream', status: 'running', message: 'Connecting to cloud workflow', progress: 10 })
        const cloud = new LocalDreamCloudConnector(browserStorage)
        const photos = await Promise.all((params.inputImages || []).map(image => cloud.upload(image.split(',')[1] || image, this.controller!.signal)))
        let job = await cloud.submit({ prompt: params.prompt, operation: operation as CloudOperation,
          image: photos[0]?.filename, references: photos.slice(1).map(photo => photo.filename), max_cost_usd: 0.5 }, this.controller.signal)
        this.updateJob({ jobId: job.id })
        while (!['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'].includes(job.state)) {
          await new Promise<void>((resolve, reject) => {
            const signal = this.controller!.signal
            const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
            signal.addEventListener('abort', abort, { once: true })
          })
          job = await cloud.reconnect(this.controller.signal)
          this.updateJob({ message: job.message, progress: Math.min(90, (this.currentJob?.progress || 10) + 2) })
        }
        if (job.state !== 'complete' || !job.images.length) throw new Error(job.message || 'Cloud job needs review')
        imageUrl = cloud.base + '/api/images/' + encodeURIComponent(job.images[0].filename)
        completedCloud = cloud
      } else {
        if (!useAuthStore.getState().apiKey) throw new Error('Connect your Venice API key to create or edit images')
        this.updateJob({ status: 'running', progress: 20, message: 'Processing with Venice' })
        if (params.inputImages?.length) {
          const prompt = params.prompt || 'Improve this image while preserving its identity, composition and subject count'
          imageUrl = await veniceImageAPI.process(operation === 'create' ? 'edit' : operation, params.inputImages, prompt, params.route.autoSettings, this.controller.signal)
        } else {
          if (operation !== 'create' && operation !== 'auto') throw new Error('Attach a source photo for this operation')
          const settings = params.route.autoSettings
          const aspect = String(settings.aspect_ratio || '1:1').split(':').map(Number)
          const ratio = aspect[0] / aspect[1] || 1
          const width = Math.round((ratio >= 1 ? 1024 : 1024 * ratio) / 64) * 64
          const height = Math.round((ratio >= 1 ? 1024 / ratio : 1024) / 64) * 64
          const result = await veniceImageAPI.generateImage({ prompt: params.enhancedPrompt,
            model: useSettingsStore.getState().selectedModels.image || undefined,
            negative_prompt: typeof settings.negative_prompt === 'string' ? settings.negative_prompt : undefined,
            width, height, steps: Number(settings.steps) || (params.route.quality === 'fast' ? 12 : 24) }, this.controller.signal)
          imageUrl = result.images[0].url
        }
      }
      await saveGeneratedImage({ id: this.currentJob!.id, imageUrl, prompt: params.prompt, provider: this.currentJob!.provider })
      if (completedCloud) await completedCloud.acknowledge()
      this.updateJob({ status: 'completed', progress: 100, message: 'Complete · saved on this device', imageUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed'
      this.updateJob({ status: 'failed', error: message, message })
    } finally { this.controller = null }
    return this.currentJob!
  }
  getCurrentJob() { return this.currentJob }
  clearJob() {
    if (this.currentJob && ACTIVE.has(this.currentJob.status)) throw new Error('Finish or cancel the active job first')
    this.currentJob = null; this.notify()
  }
  async cancel() {
    this.controller?.abort()
    if (this.currentJob?.provider === 'local-dream') {
      const cloud = new LocalDreamCloudConnector(browserStorage)
      if (cloud.pending()) await cloud.cancel()
    }
  }
  async processOfflineQueue() {
    if (this.processingQueue || (typeof navigator !== 'undefined' && !navigator.onLine) || (this.currentJob && ACTIVE.has(this.currentJob.status))) return
    this.processingQueue = true
    try {
      for (const item of await getQueuedGenerations()) {
        if (item.retryCount >= 3) continue // Retain exhausted work for recovery; never silently delete it.
        const job = await this.startGeneration(item.params)
        if (job.status === 'completed') await dequeueGeneration(item.id)
        else { await incrementRetryCount(item.id); break }
      }
    } finally { this.processingQueue = false }
  }
}
export const generationExecutor = new GenerationExecutor()
