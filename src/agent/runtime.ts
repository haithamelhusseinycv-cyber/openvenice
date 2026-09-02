import { AgentToolRegistry } from './tool-registry'
import { createLocalDreamTools } from './toolsets/localdream-tools'
import type { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { createFaceFusionTools } from './toolsets/facefusion-tools'

let defaultRegistry: AgentToolRegistry | null = null

export function createAgentRegistry(options: { faceFusion?: FaceFusionConnector } = {}) {
  const registry = new AgentToolRegistry()
  for (const tool of createLocalDreamTools()) registry.register(tool)
  if (options.faceFusion) {
    for (const tool of createFaceFusionTools(options.faceFusion)) registry.register(tool)
  }
  return registry
}

/**
 * Browser/PWA runtime. Local Dream works through its localhost HTTP service.
 * FaceFusion is registered later by the native Android shell once its
 * signature-protected bridge transport is available.
 */
export function getDefaultAgentRegistry() {
  if (!defaultRegistry) defaultRegistry = createAgentRegistry()
  return defaultRegistry
}
