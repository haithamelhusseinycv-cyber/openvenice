import { describe, expect, it } from 'vitest'
import { FaceFusionConnector, type FaceFusionBridgeTransport, type FaceFusionModelCatalog } from './facefusion-connector'
import { createFaceFusionTools } from '../../agent/toolsets/facefusion-tools'

class MemoryBridge implements FaceFusionBridgeTransport {
  catalog: FaceFusionModelCatalog
  lastEnsure?: { packIds?: string[]; includeOptional?: boolean }
  constructor() {
    this.catalog = {
      detectors: [],
      recognizers: [],
      landmarks: [],
      swappers: [],
      faceEnhancers: [],
      frameEnhancers: [],
      ready: false,
      missing: ['analysis_retinaface', 'analysis_arcface', 'analysis_2dfan4', 'inswapper_128_fp16'],
    }
  }
  async isAvailable() {
    return true
  }
  async listModels() {
    return this.catalog
  }
  async ensureModels(request: { packIds?: string[]; includeOptional?: boolean } = {}) {
    this.lastEnsure = request
    this.catalog = {
      detectors: ['analysis_retinaface'],
      recognizers: ['analysis_arcface'],
      landmarks: ['analysis_2dfan4'],
      swappers: ['inswapper_128_fp16'],
      faceEnhancers: request.includeOptional ? ['codeformer'] : [],
      frameEnhancers: request.includeOptional ? ['real_esrgan_x4_fp16'] : [],
      ready: true,
      missing: [],
      selected: { swapper: 'inswapper_128_fp16.onnx', faceEnhancer: 'none', frameEnhancer: 'none' },
    }
    return {
      ready: true,
      downloaded: ['analysis_retinaface', 'analysis_arcface', 'analysis_2dfan4', 'inswapper_128_fp16'],
      skipped: [],
      failed: [],
      missing: [],
      selected: this.catalog.selected,
    }
  }
  async detectFaces() {
    return []
  }
  async swap() {
    return { outputUri: 'content://out' }
  }
  async enhance() {
    return { outputUri: 'content://out' }
  }
  async cancel() {}
}

describe('FaceFusion ensure_models tool', () => {
  it('downloads the minimum packs and reports ready', async () => {
    const bridge = new MemoryBridge()
    const tools = createFaceFusionTools(new FaceFusionConnector(bridge))
    const ensure = tools.find((tool) => tool.id === 'facefusion.ensure_models')
    expect(ensure).toBeTruthy()
    const result = await ensure!.execute({}, {})
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ ready: true })
    expect(bridge.lastEnsure).toEqual({ packIds: undefined, includeOptional: undefined })
  })

  it('exposes missing packs on list_models before download', async () => {
    const bridge = new MemoryBridge()
    const tools = createFaceFusionTools(new FaceFusionConnector(bridge))
    const list = tools.find((tool) => tool.id === 'facefusion.list_models')
    const result = await list!.execute({}, {})
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ ready: false, missing: expect.arrayContaining(['inswapper_128_fp16']) })
  })
})
