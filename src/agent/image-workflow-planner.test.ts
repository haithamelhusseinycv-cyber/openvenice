import { describe, expect, it } from 'vitest'
import { buildImageWorkflow, validateVisualIntent, measurePixels, easySettings, type VisualIntent, type WorkflowCatalog } from './image-workflow-planner'
const intent = (operation: VisualIntent['operation'], extra = {}): VisualIntent => ({ operation, reason: 'Visible evidence', target: '', preserve: ['appearance'], issues: [], clarification: '', ...extra })
const empty = (): WorkflowCatalog => ({ venice: [], cloud: [] })
const face = { detectors: [], recognizers: [], landmarks: [], swappers: ['installed-swapper'], faceEnhancers: ['codeformer'], frameEnhancers: ['realesrgan'] }
describe('visual workflow planner', () => {
  it('rejects invented operations and missing/ignored image inputs', () => {
    expect(() => validateVisualIntent({ operation: 'shell' }, 1)).toThrow()
    expect(() => validateVisualIntent({ operation: 'create' }, 1)).toThrow()
    expect(() => validateVisualIntent({ operation: 'edit' }, 2)).toThrow()
    expect(() => validateVisualIntent({ operation: 'swap' }, 1)).toThrow()
    expect(() => validateVisualIntent({ operation: 'masked_edit', target: '' }, 1)).toThrow()
  })
  it('keeps a localized edit on the protected cloud workflow', () => {
    const plan = buildImageWorkflow(intent('masked_edit', { target: 'blazer' }), { ...empty(), cloud: ['masked_edit'] }, [])
    expect(plan.engine).toBe('easy-cloud'); expect(plan.settings.operation).toBe('auto')
    expect(plan.preserve).toEqual(['appearance']); expect(plan.settings.review_output).toBe(true)
  })
  it('routes face swap only to installed specialist models without automatic beautification', () => {
    const plan = buildImageWorkflow(intent('swap'), { ...empty(), face }, [])
    expect(plan.model).toBe('installed-swapper'); expect(plan.engine).toBe('facefusion')
    expect(plan.settings.faceEnhancer).toBe('none')
    expect(() => buildImageWorkflow(intent('swap'), empty(), [])).toThrow()
  })
  it('does not invent an unavailable Venice model', () => {
    const catalog = { ...empty(), venice: [{ id: 'live-model', object: 'model', created: 0, owned_by: 'venice' }] }
    expect(() => buildImageWorkflow(intent('create', { veniceModelId: 'obsolete-model' }), catalog, [])).toThrow()
    expect(buildImageWorkflow(intent('create', { veniceModelId: 'live-model' }), catalog, []).quality).toBe('best')
  })
  it('retains distilled Easy model-specific defaults and supported aspect ratio', () => {
    const model = { id: 'lightning', name: 'Lightning', run_on_cpu: false, is_sdxl: true, is_anima: false, is_custom: false,
      generation_size: 1024, defaults: { prompt: '', negative_prompt: '', steps: 4, cfg: 1, scheduler: 'euler' }, resolutions: [[1024,1024],[768,1024]] as Array<[number,number]> }
    expect(easySettings(model, { width: 300, height: 400, meanLuma: 0, darkFraction: 0, brightFraction: 0, edgeVariance: 0, hasTransparency: false })).toMatchObject({ width: 768, height: 1024, steps: 4, cfg: 1, scheduler: 'euler', denoise_strength: .3 })
    expect(buildImageWorkflow(intent('create', { easyModelId: 'lightning' }), { ...empty(), easy: { models: [model], upscalers: [], use_img2img: true } }, []).engine).toBe('easy-phone')
  })
  it('measures actual luminance and transparency without pretending to recognize subjects', () => {
    const pixels = new Uint8ClampedArray(4*4*4)
    for (let i=0;i<16;i++) pixels.set([255,255,255,255],i*4)
    pixels[3] = 0
    const facts = measurePixels(pixels,4,4,100,100)
    expect(facts.meanLuma).toBeCloseTo(255); expect(facts.hasTransparency).toBe(true)
    expect(facts.edgeVariance).toBe(0); expect(facts.brightFraction).toBe(1)
  })
})
