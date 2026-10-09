import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ImageWorkflowPlan } from './image-workflow-planner'
const mocks = vi.hoisted(() => ({ request: vi.fn(), generate: vi.fn(), process: vi.fn(), enhance: vi.fn(), swap: vi.fn(), detect: vi.fn() }))
vi.mock('../lib/venice-client', () => ({ venice: mocks.request }))
vi.mock('../lib/venice-image-api', () => ({ veniceImageAPI: { generateImage: mocks.generate, process: mocks.process } }))
vi.mock('../stores/auth-store', () => ({ useAuthStore: { getState: () => ({ apiKey: 'test-fixture' }) } }))
vi.mock('../connectors/facefusion/default-connector', () => ({ defaultFaceFusionConnector: () => ({ enhance: mocks.enhance, swap: mocks.swap, detectFaces: mocks.detect }) }))
vi.mock('./image-workflow-planner', async importOriginal => ({ ...await importOriginal<object>(), inspectPhoto: async () => ({ width: 512, height: 512 }) }))
import { produceImage, visualReasoning, reviewImage } from './image-workflow-service'
const plan = (engine: ImageWorkflowPlan['engine'], operation: ImageWorkflowPlan['operation'], settings = {}): ImageWorkflowPlan => ({
  engine, operation, model: 'selected-live-model', settings, reason: 'Evidence', target: '', preserve: ['appearance'], issues: [], stages: [], facts: [], quality: 'best',
})
describe('image workflow execution wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 512, height: 512, close: vi.fn() })))
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => 'data:image/jpeg;base64,AA==' }) })
  })
  it('sends actual photo content to a discovered vision-capable model', async () => {
    mocks.request.mockResolvedValueOnce({ data: [{ id: 'vision-live', model_spec: { capabilities: { supportsVision: true }, traits: ['most_intelligent'] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"operation":"edit"}' } }] })
    const result = await visualReasoning('System', 'Request', ['data:image/png;base64,AA=='])
    expect(result).toEqual({ operation: 'edit' })
    const body = JSON.parse(mocks.request.mock.calls[1][1].body)
    expect(body.model).toBe('vision-live')
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AA==')
  })
  it('does not treat a text-only model as photo reasoning', async () => {
    mocks.request.mockResolvedValueOnce({ data: [{ id: 'text-only', model_spec: { capabilities: {} } }] })
    await expect(visualReasoning('System', 'Request', ['data:image/png;base64,AA=='])).rejects.toThrow('No available Venice model')
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('forwards the selected live model and its supported settings to generation', async () => {
    mocks.generate.mockResolvedValue({ images: [{ url: 'result' }] })
    await expect(produceImage(plan('venice', 'create', { steps: 28, aspect_ratio: '3:4' }), 'Unchanged prompt', [], new AbortController().signal, vi.fn())).resolves.toEqual({ output: 'result' })
    expect(mocks.generate.mock.calls[0][0]).toEqual({ model: 'selected-live-model', prompt: 'Unchanged prompt', steps: 28, aspect_ratio: '3:4' })
  })
  it('forwards installed FaceFusion settings and keeps the original/reference order', async () => {
    mocks.detect.mockResolvedValue([{ index: 0 }]); mocks.swap.mockResolvedValue({ outputUri: 'result' })
    await produceImage(plan('facefusion', 'swap', { swapper: 'installed', faceEnhancer: 'none' }), 'Swap', ['original', 'reference'], new AbortController().signal, vi.fn())
    expect(mocks.swap.mock.calls[0][0]).toEqual({ targetUri: 'original', sourceUri: 'reference', swapper: 'installed', faceEnhancer: 'none' })
  })
  it('stops before processing when an automatic swap has ambiguous faces', async () => {
    mocks.detect.mockResolvedValue([{ index: 0 }, { index: 1 }])
    await expect(produceImage(plan('facefusion', 'swap'), 'Swap', ['original', 'reference'], new AbortController().signal, vi.fn())).rejects.toThrow('exactly one face')
    expect(mocks.swap).not.toHaveBeenCalled()
  })
  it('does not convert malformed or contradictory review evidence into success', async () => {
    mocks.request.mockResolvedValueOnce({ data: [{ id: 'vision', model_spec: { capabilities: { supportsVision: true } } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"passed":true,"issues":["visible artifacts"]}' } }] })
    await expect(reviewImage('Request', [], 'data:image/png;base64,AA==', new AbortController().signal)).resolves.toEqual({ passed: false, issues: ['visible artifacts'] })
  })
})
