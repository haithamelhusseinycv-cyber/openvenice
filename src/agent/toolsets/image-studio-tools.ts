import type { AgentTool } from '../types'
import { planImageWorkflow, produceImage, reviewImage, imageCloud } from '../image-workflow-service'
import { saveGeneratedImage } from '../../lib/image-persistence'
export function createImageStudioTools(): AgentTool[] {
  return [{
    id: 'intelligent.run_image_workflow',
    name: 'Understand, route and produce image',
    description: 'Unified Best photo workflow. Inspects actual pixels and uses live vision reasoning; discovers ready Easy phone/cloud, Venice and FaceFusion models, applies supported settings, preserves originals, produces and visually reviews the output. Cloud jobs are durable with a $0.25 estimate limit. Use for image requests instead of keyword routing. First photo is original; remaining photos are references. Never invent photo data.',
    risk: 'write', permissions: ['network', 'local-app-control'],
    inputSchema: { type: 'object', additionalProperties: false, required: ['prompt'], properties: {
      prompt: { type: 'string', maxLength: 5000 }, images: { type: 'array', maxItems: 3, items: { type: 'string', description: 'Actual image data URL or existing artifact reference' } },
    } },
    execute: async (input, context) => {
      const v = input as { prompt: string; images?: string[] }
      const photos = (v.images || []).map(uri => context.artifacts?.resolveData(uri) || uri)
      if (photos.length > 3 || photos.some(p => !p.startsWith('data:image/'))) return { ok: false, error: 'Supply embedded photo data or valid image artifacts' }
      if (imageCloud().pending()) return { ok: false, error: 'Reconnect to the saved cloud job before starting another image task' }
      const controller = new AbortController(), forward = () => controller.abort()
      context.signal?.addEventListener('abort', forward, { once: true })
      if (context.signal?.aborted) controller.abort()
      const deadline = setTimeout(forward, 600000)
      try {
        const plan = await planImageWorkflow(v.prompt, photos, controller.signal)
        for (const [i, uri] of photos.entries()) await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: uri, prompt: (i ? 'Reference' : 'Original') + ' · ' + v.prompt, provider: 'original' })
        const produced = await produceImage(plan, v.prompt, photos, controller.signal, () => {})
        if (produced.cloudJob) return { ok: true, data: { plan, job_id: produced.cloudJob, state: 'queued', reconnect: 'localdream.cloud' } }
        if (!produced.output) return { ok: true, data: { plan, state: 'analysis_complete' } }
        await saveGeneratedImage({ id: crypto.randomUUID(), imageUrl: produced.output, prompt: v.prompt, provider: plan.engine })
        const artifact = context.artifacts?.put(produced.output, { sourceTool: 'intelligent.run_image_workflow', mimeType: produced.output.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png' })
        let review: { passed: boolean; issues: string[] }
        try { review = await reviewImage(v.prompt, photos, produced.output, controller.signal) }
        catch { review = { passed: false, issues: ['Visual review could not be completed; the saved candidate needs review'] } }
        return { ok: true, data: { plan, state: review.passed ? 'complete' : 'needs_review', review, image: artifact?.ref || produced.output, mimeType: artifact?.metadata.mimeType } }
      } catch (e) {
        if (controller.signal.aborted && imageCloud().pending()) await imageCloud().cancel().catch(() => {})
        return { ok: false, error: e instanceof Error ? e.message : 'Image workflow failed' }
      } finally { clearTimeout(deadline); context.signal?.removeEventListener('abort', forward) }
    },
  }]
}
