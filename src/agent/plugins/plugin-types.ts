import type { AgentTool, ToolPermission } from '../types'

export interface AgentPluginManifest {
  id: string
  name: string
  version: string
  description: string
  capabilities: string[]
  permissions: ToolPermission[]
  entrypoint: string
  builtIn?: boolean
  requiresNative?: boolean
  license?: string
  sourceUrl?: string
  sha256?: string
  signature?: string
}

export interface AgentPluginDefinition {
  manifest: AgentPluginManifest
  createTools: () => AgentTool[]
  enabledByDefault?: boolean
}

export interface AgentPluginSnapshot {
  manifest: AgentPluginManifest
  enabled: boolean
  toolIds: string[]
}
