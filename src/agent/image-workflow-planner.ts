import type { LocalDreamCatalog, LocalDreamModelInfo } from '../connectors/localdream/localdream-connector'
import type { FaceFusionModelCatalog } from '../connectors/facefusion/facefusion-connector'
import type { VeniceModel, ImageConstraints } from '../types/venice'

export type ImageTask = 'create' | 'edit' | 'combine' | 'masked_edit' | 'remove_background' | 'upscale' | 'face_detailer' | 'swap' | 'analyze'
export type ImageEngine = 'easy-phone' | 'easy-cloud' | 'venice' | 'facefusion'
export interface PixelFacts { width: number; height: number; meanLuma: number; darkFraction: number; brightFraction: number; edgeVariance: number; hasTransparency: boolean }
export interface WorkflowCatalog { easy?: LocalDreamCatalog; face?: FaceFusionModelCatalog; venice: VeniceModel[]; cloud: string[] }
export interface VisualIntent { operation: ImageTask; reason: string; target: string; preserve: string[]; issues: string[]; easyModelId?: string; veniceModelId?: string; clarification: string }
export interface ImageWorkflowPlan { engine: ImageEngine; operation: ImageTask; model: string; settings: Record<string, unknown>; reason: string; target: string; preserve: string[]; issues: string[]; stages: string[]; facts: PixelFacts[]; quality: 'best' }
const tasks = new Set<ImageTask>(['create', 'edit', 'combine', 'masked_edit', 'remove_background', 'upscale', 'face_detailer', 'swap', 'analyze'])
const textList = (value: unknown) => Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string').slice(0, 12).map(s => s.slice(0, 300)) : []
export function validateVisualIntent(value: unknown, count: number): VisualIntent {
  if (!value || typeof value !== 'object') throw new Error('Visual planner returned no usable plan')
  const v = value as Record<string, unknown>
  if (!tasks.has(v.operation as ImageTask)) throw new Error('Visual planner selected an unsupported task')
  const op = v.operation as ImageTask
  const clarification = typeof v.clarification === 'string' ? v.clarification.trim().slice(0, 300) : ''
  if (clarification) throw new Error(clarification)
  if (op === 'create' && count || op !== 'create' && !count) throw new Error('The plan does not match the supplied photos')
  if (['swap', 'combine'].includes(op) && count < 2) throw new Error('This task needs an original and a reference photo')
  if (count > 1 && !['swap', 'combine', 'analyze'].includes(op)) throw new Error('The planner must account for every supplied reference')
  if (op === 'masked_edit' && (typeof v.target !== 'string' || !v.target.trim())) throw new Error('The localized edit needs a specific region')
  return { operation: op, reason: typeof v.reason === 'string' ? v.reason.slice(0, 600) : 'Based on the requested result',
    target: typeof v.target === 'string' ? v.target.slice(0, 200) : '', preserve: textList(v.preserve), issues: textList(v.issues),
    easyModelId: typeof v.easyModelId === 'string' ? v.easyModelId : undefined,
    veniceModelId: typeof v.veniceModelId === 'string' ? v.veniceModelId : undefined, clarification: '' }
}
export function measurePixels(data: Uint8ClampedArray, sampledWidth: number, sampledHeight: number, width: number, height: number): PixelFacts {
  if (sampledWidth < 3 || sampledHeight < 3 || data.length !== sampledWidth * sampledHeight * 4) throw new Error('Invalid image pixels')
  const gray = new Float64Array(sampledWidth * sampledHeight)
  let sum = 0, dark = 0, bright = 0, alpha = false
  for (let i = 0; i < gray.length; i++) {
    const luma = .2126 * data[i * 4] + .7152 * data[i * 4 + 1] + .0722 * data[i * 4 + 2]
    gray[i] = luma; sum += luma; dark += Number(luma < 12); bright += Number(luma > 243); alpha ||= data[i * 4 + 3] < 255
  }
  let lapSum = 0, lapSq = 0, n = 0
  for (let y = 1; y < sampledHeight - 1; y++) for (let x = 1; x < sampledWidth - 1; x++) {
    const i = y * sampledWidth + x
    const lap = gray[i - 1] + gray[i + 1] + gray[i - sampledWidth] + gray[i + sampledWidth] - 4 * gray[i]
    lapSum += lap; lapSq += lap * lap; n++
  }
  return { width, height, meanLuma: sum / gray.length, darkFraction: dark / gray.length, brightFraction: bright / gray.length,
    edgeVariance: Math.max(0, lapSq / n - (lapSum / n) ** 2), hasTransparency: alpha }
}
export async function inspectPhoto(uri: string): Promise<PixelFacts> {
  if (!uri.startsWith('data:image/')) throw new Error('Choose an embedded image')
  const blob = await (await fetch(uri)).blob()
  const image = await createImageBitmap(blob)
  try {
    if (image.width * image.height > 8_000_000) throw new Error('Choose a photo under 8 megapixels')
    const scale = Math.min(1, 256 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(3, Math.round(image.width * scale)); canvas.height = Math.max(3, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Image analysis is unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return measurePixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, image.width, image.height)
  } finally { image.close() }
}
export function easySettings(model: LocalDreamModelInfo, facts?: PixelFacts) {
  const resolutions = model.resolutions.length ? model.resolutions : [[model.generation_size || 512, model.generation_size || 512]]
  const aspect = facts ? facts.width / facts.height : 1
  const size = [...resolutions].sort((a, b) => Math.abs(a[0] / a[1] - aspect) - Math.abs(b[0] / b[1] - aspect) || b[0] * b[1] - a[0] * a[1])[0]
  // Distilled/Lightning models retain their own step/CFG/scheduler defaults.
  return { ...model.defaults, width: size[0], height: size[1], denoise_strength: facts ? 0.3 : undefined, output_format: 'png' }
}
export function buildImageWorkflow(intent: VisualIntent, catalog: WorkflowCatalog, facts: PixelFacts[]): ImageWorkflowPlan {
  const operation = intent.operation
  let engine: ImageEngine, model = '', settings: Record<string, unknown> = {}
  const reason = [intent.reason]
  const face = catalog.face
  if (operation === 'swap' || ['face_detailer', 'upscale'].includes(operation) && face && (operation === 'face_detailer' ? face.faceEnhancers.length : face.frameEnhancers.length)) {
    if (!face) throw new Error('Open FaceFusion on this phone to make the swap workflow available')
    engine = 'facefusion'
    const pick = (items: string[], preferred?: string) => items.includes(preferred || '') ? preferred! : [...items].sort((a,b) => Number(/codeformer|real.?esrgan|swinir/i.test(b)) - Number(/codeformer|real.?esrgan|swinir/i.test(a)))[0]
    model = operation === 'swap' ? pick(face.swappers, face.selected?.swapper) : operation === 'face_detailer' ? pick(face.faceEnhancers, face.selected?.faceEnhancer) : pick(face.frameEnhancers, face.selected?.frameEnhancer)
    if (!model) throw new Error('The required FaceFusion model is not installed')
    settings = { swapper: operation === 'swap' ? model : undefined, faceEnhancer: operation === 'face_detailer' ? model : 'none', frameEnhancer: operation === 'upscale' ? model : 'none' }
    reason.push('Use installed specialist models; leave unrequested face restoration off.')
  } else if ((operation === 'create' || operation === 'edit' && catalog.easy?.use_img2img) && catalog.easy?.models.some(m => m.id === intent.easyModelId)) {
    engine = 'easy-phone'
    const selected = catalog.easy.models.find(m => m.id === intent.easyModelId)!
    model = selected.id; settings = easySettings(selected, facts[0])
    reason.push('Selected from downloaded Easy models using their supported resolutions and model-specific defaults.')
  } else if (['masked_edit', 'combine'].includes(operation) && catalog.cloud.includes(operation)) {
    engine = 'easy-cloud'; model = 'gateway Best validated profile'
    settings = { operation: 'auto', target: intent.target, quality: 'high', speed: 'quality', review_output: true }
    reason.push('The durable cloud visual planner configures its validated workflow and preserves source/intermediate versions.')
  } else if (operation !== 'analyze' && catalog.venice.length) {
    engine = 'venice'
    if (operation === 'create') {
      const selected = catalog.venice.find(m => m.id === intent.veniceModelId)
      if (!selected) throw new Error('The visual planner must select a currently available Venice image model')
      model = selected.id
      const c = selected.model_spec?.constraints as ImageConstraints | undefined
      settings = { aspect_ratio: c?.defaultAspectRatio, steps: c?.steps?.default }
      reason.push('Use the selected live Venice model and its advertised defaults.')
    } else {
      if (operation === 'masked_edit' || operation === 'face_detailer') throw new Error('This precise workflow needs the cloud masked editor or installed FaceFusion models')
      model = operation === 'upscale' ? 'Venice upscale' : operation === 'remove_background' ? 'Venice background removal' : 'Venice multi-edit'
      settings = { aspect_ratio: 'auto' }
      reason.push('Use the existing Venice image endpoint; preserve the original aspect ratio.')
    }
  } else if (operation === 'analyze') { engine = 'venice'; model = 'visual analysis'; reason.push('Analysis only; the original is unchanged.') }
  else if (catalog.cloud.includes(operation)) { engine = 'easy-cloud'; model = 'gateway Best validated profile'; settings = { operation: 'auto', review_output: true } }
  else throw new Error('No ready engine supports this workflow. Connect Venice, download an Easy model, or start the appropriate phone companion.')
  return { engine, operation, model, settings, reason: reason.join(' '), target: intent.target, preserve: intent.preserve,
    issues: intent.issues, stages: ['Understand', 'Plan', 'Configure', 'Produce', 'Review', 'Finish'], facts, quality: 'best' }
}
