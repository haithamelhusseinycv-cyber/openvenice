export interface AgentArtifactMetadata {
  format?: string
  mimeType?: string
  width?: number
  height?: number
  sourceTool?: string
  [key: string]: unknown
}

export interface AgentArtifact {
  id: string
  ref: string
  data: string
  metadata: AgentArtifactMetadata
}

function createArtifactId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export class AgentArtifactStore {
  private readonly artifacts = new Map<string, AgentArtifact>()

  put(data: string, metadata: AgentArtifactMetadata = {}): AgentArtifact {
    const id = createArtifactId()
    const artifact: AgentArtifact = {
      id,
      ref: `artifact://${id}`,
      data,
      metadata,
    }
    this.artifacts.set(id, artifact)
    return artifact
  }

  get(refOrId: string): AgentArtifact | undefined {
    const id = refOrId.startsWith('artifact://') ? refOrId.slice('artifact://'.length) : refOrId
    return this.artifacts.get(id)
  }

  resolveData(refOrData: string): string {
    return this.get(refOrData)?.data ?? refOrData
  }

  list(): AgentArtifact[] {
    return Array.from(this.artifacts.values())
  }
}
