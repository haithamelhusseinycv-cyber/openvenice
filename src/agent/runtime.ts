import { AgentToolRegistry } from './tool-registry'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'
import { AgentPluginManager } from './plugins/plugin-manager'
import { createFaceFusionPlugin, createLocalDreamPlugin } from './plugins/builtin-plugins'
import { createPluginManagementTools } from './toolsets/plugin-tools'

export interface AgentRuntime {
  registry: AgentToolRegistry
  plugins: AgentPluginManager
}

let defaultRuntime: AgentRuntime | null = null

export function createAgentRuntime(options: { faceFusion?: FaceFusionConnector } = {}): AgentRuntime {
  const registry = new AgentToolRegistry()
  const plugins = new AgentPluginManager(registry)

  plugins.register(createLocalDreamPlugin())
  if (options.faceFusion) plugins.register(createFaceFusionPlugin(options.faceFusion))
  plugins.enableDefaults()

  for (const tool of createPluginManagementTools(plugins, registry)) registry.register(tool)
  return { registry, plugins }
}

export function createAgentRegistry(options: { faceFusion?: FaceFusionConnector } = {}) {
  return createAgentRuntime(options).registry
}

function nativeFaceFusionConnector() {
  if (!isNativeOpenVeniceAndroid()) return undefined
  return new FaceFusionConnector(new CapacitorFaceFusionBridge())
}

function getDefaultAgentRuntime() {
  if (!defaultRuntime) {
    defaultRuntime = createAgentRuntime({ faceFusion: nativeFaceFusionConnector() })
  }
  return defaultRuntime
}

/**
 * Local Dream is exposed as an enabled built-in plugin in both the PWA and
 * Android shell. FaceFusion is added only inside native OpenVenice Android,
 * where the signature-protected Capacitor plugin can bind to its bridge.
 * Plugin-management tools are always available so Qwen can inspect and toggle
 * already-known plugins without downloading or executing arbitrary code.
 */
export function getDefaultAgentRegistry() {
  return getDefaultAgentRuntime().registry
}

export function getDefaultPluginManager() {
  return getDefaultAgentRuntime().plugins
}
