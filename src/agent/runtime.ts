import { AgentToolRegistry } from './tool-registry'
import { createLocalDreamTools } from './toolsets/localdream-tools'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'
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

function nativeFaceFusionConnector() {
  if (!isNativeOpenVeniceAndroid()) return undefined
  return new FaceFusionConnector(new CapacitorFaceFusionBridge())
}

/**
 * Local Dream works through its localhost HTTP service in both the PWA and
 * Android shell. FaceFusion tools are registered automatically only inside the
 * native OpenVenice Android app, where the signature-protected Capacitor
 * plugin can bind to FaceFusion's AgentBridgeService.
 */
export function getDefaultAgentRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createAgentRegistry({ faceFusion: nativeFaceFusionConnector() })
  }
  return defaultRegistry
}
