/**
 * Atelier connector — talks to the NSFW orchestrator gateway.
 * Supports direct localhost (18080) or SSH tunnel to Vast GPU 51253074.
 */



export interface AtelierConfig {
  baseUrl: string
  controllerModel?: string
  controllerApiKey?: string
  sshTunnel?: {
    host: string
    port: number
    localPort: number
  }
}

export interface AtelierJob {
  id: string
  status: 'queued' | 'planning' | 'processing' | 'reviewing' | 'complete' | 'failed'
  progress: number
  output?: string[]
  error?: string
  workflow: string
  createdAt: number
  completedAt?: number
}

export interface AtelierWorkflow {
  id: string
  name: string
  purpose: string
  capabilities: string[]
  placeholders: string[]
  icon: string
  category: 'generate' | 'edit' | 'enhance' | 'restore'
}

const DEFAULT_CONFIG: AtelierConfig = {
  baseUrl: 'http://127.0.0.1:18080',
  controllerModel: 'Qwen/Qwen2.5-VL-7B-Instruct',
}

const WORKFLOW_PRESETS: AtelierWorkflow[] = [
  {
    id: 'full_edit',
    name: 'Full Edit',
    purpose: 'Complete image transformation with identity preservation',
    capabilities: ['BiRefNet', 'GroundingDINO', 'SAM2.1', 'DWPose', 'DepthAnythingV2', 'QwenImageEdit2511', 'InfiniteYou', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '✨',
    category: 'edit',
  },
  {
    id: 'identity_edit',
    name: 'Identity Edit',
    purpose: 'Preserve face identity while changing context',
    capabilities: ['BiRefNet', 'GroundingDINO', 'SAM2.1', 'InfiniteYou', 'FaceDetailer', 'SUPIR'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '👤',
    category: 'edit',
  },
  {
    id: 'identity_pulid',
    name: 'PuLID Identity',
    purpose: 'Advanced identity preservation with PuLID',
    capabilities: ['PuLID', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '',
    category: 'edit',
  },
  {
    id: 'pose_edit',
    name: 'Pose Control',
    purpose: 'Control body pose and positioning',
    capabilities: ['GroundingDINO', 'SAM2.1', 'DWPose', 'DepthAnythingV2', 'QwenImageEdit2511', 'FLUXFill', 'InfiniteYou', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${POSE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '',
    category: 'edit',
  },
  {
    id: 'geometry_edit',
    name: 'Geometry Edit',
    purpose: 'Modify body shape and proportions',
    capabilities: ['GroundingDINO', 'SAM2.1', 'DWPose', 'DepthAnythingV2', 'QwenImageEdit2511', 'FLUXFill', 'InfiniteYou', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '📐',
    category: 'edit',
  },
  {
    id: 'background_replace',
    name: 'Background Replace',
    purpose: 'Replace or modify background',
    capabilities: ['BiRefNet', 'GroundingDINO', 'SAM2.1', 'DepthAnythingV2', 'FLUXFill', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '🖼️',
    category: 'edit',
  },
  {
    id: 'literal_swap',
    name: 'Literal Swap',
    purpose: 'Direct face/body swap',
    capabilities: ['BiRefNet', 'GroundingDINO', 'SAM2.1', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '🔄',
    category: 'edit',
  },
  {
    id: 'local_fill',
    name: 'Inpainting',
    purpose: 'Fill or modify specific regions',
    capabilities: ['GroundingDINO', 'SAM2.1', 'FLUXFill', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${MASK_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '🎨',
    category: 'edit',
  },
  {
    id: 'reference_render',
    name: 'Reference Render',
    purpose: 'Generate from reference image',
    capabilities: ['BiRefNet', 'GroundingDINO', 'SAM2.1', 'QwenImageEdit2511', 'InfiniteYou', 'FaceDetailer', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '📸',
    category: 'generate',
  },
  {
    id: 'restore_only',
    name: 'Restore & Upscale',
    purpose: 'Restore quality and upscale',
    capabilities: ['SUPIR', 'RealESRGAN', 'FaceDetailer'],
    placeholders: ['${INPUT_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '✨',
    category: 'enhance',
  },
  {
    id: 'fallback_ace',
    name: 'ACE Fallback',
    purpose: 'Fallback editor with ACE Plus',
    capabilities: ['ACEPlus', 'SAM2.1', 'SUPIR', 'RealESRGAN'],
    placeholders: ['${USER_PROMPT}', '${INPUT_IMAGE}', '${REFERENCE_IMAGE}', '${OUTPUT_COUNT}', '${QUALITY_MODE}'],
    icon: '🛟',
    category: 'edit',
  },
]

export class AtelierConnector {
  private config: AtelierConfig
  private baseUrl: string

  constructor(config: Partial<AtelierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.baseUrl = this.config.baseUrl.replace(/\/$/, '')
  }

  getWorkflows(): AtelierWorkflow[] {
    return WORKFLOW_PRESETS
  }

  async health(): Promise<{ ok: boolean; gpu?: string; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
      const data = await res.json()
      return { ok: true, gpu: data.gpu, message: data.message }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async analyze(prompt: string, inputImages: string[], qualityMode: 'fast' | 'balanced' | 'best' = 'balanced') {
    try {
      const res = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, input_filenames: inputImages, quality_mode: qualityMode }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch {
      return null
    }
  }

  async generate(params: {
    prompt: string
    workflow: string
    inputImages?: string[]
    referenceImage?: string
    maskImage?: string
    poseImage?: string
    qualityMode?: 'fast' | 'balanced' | 'best'
    outputCount?: number
    preserveIdentity?: boolean
  }): Promise<{ jobId: string }> {
    const res = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        workflow: params.workflow,
        input_filenames: params.inputImages || [],
        reference_image: params.referenceImage,
        mask_image: params.maskImage,
        pose_image: params.poseImage,
        quality_mode: params.qualityMode || 'balanced',
        output_count: params.outputCount || 1,
        preserve_identity: params.preserveIdentity ?? false,
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { jobId: data.job_id }
  }

  async getJob(jobId: string): Promise<AtelierJob | null> {
    try {
      const res = await fetch(`${this.baseUrl}/job/${jobId}`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/job/${jobId}/cancel`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async startGpu(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/gpu/start`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async stopGpu(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/gpu/stop`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const atelierConnector = new AtelierConnector()
