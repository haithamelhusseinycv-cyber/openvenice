import { AgentToolRegistry } from './tool-registry'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from '../connectors/facefusion/capacitor-facefusion-bridge'
import { GithubConnector } from '../connectors/github/github-connector'
import { GraphConnector } from '../connectors/microsoft-graph/graph-connector'
import { ResearchConnector } from '../connectors/research/research-connector'
import { AgentPluginManager } from './plugins/plugin-manager'
import {
  createFaceFusionPlugin,
  createGithubPlugin,
  createGraphPlugin,
  createLocalDreamPlugin,
  createResearchPlugin,
} from './plugins/builtin-plugins'
import { createPluginManagementTools } from './toolsets/plugin-tools'

export interface AgentRuntime {
  registry: AgentToolRegistry
  plugins: AgentPluginManager
}

export interface AgentRuntimeOptions {
  faceFusion?: FaceFusionConnector
  github?: GithubConnector
  graph?: GraphConnector
  research?: ResearchConnector
}

let defaultRuntime: AgentRuntime | null = null

export function createAgentRuntime(options: AgentRuntimeOptions = {}): AgentRuntime {
  const registry = new AgentToolRegistry()
  const plugins = new AgentPluginManager(registry)

  plugins.register(createLocalDreamPlugin())
  plugins.register(createGithubPlugin(options.github ?? new GithubConnector()))
  plugins.register(createGraphPlugin(options.graph ?? new GraphConnector()))
  plugins.register(createResearchPlugin(options.research ?? new ResearchConnector()))
  if (options.faceFusion) plugins.register(createFaceFusionPlugin(options.faceFusion))
  plugins.enableDefaults()

  for (const tool of createPluginManagementTools(plugins, registry)) registry.register(tool)
  return { registry, plugins }
}

export function createAgentRegistry(options: AgentRuntimeOptions = {}) {
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
 * Local Dream, GitHub, Microsoft Graph, and Research are exposed as enabled
 * built-in plugins in both the PWA and Android shell. Host-side tokens are
 * injected by the OpenVenice proxy; the browser never receives them.
 * FaceFusion is added only inside native OpenVenice Android, where the
 * signature-protected Capacitor plugin can bind to its bridge.
 * Plugin-management tools are always available so Qwen can inspect and toggle
 * already-known plugins without downloading or executing arbitrary code.
 */
export function getDefaultAgentRegistry() {
  return getDefaultAgentRuntime().registry
}

export function getDefaultPluginManager() {
  return getDefaultAgentRuntime().plugins
}
