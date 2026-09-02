import { AgentToolRegistry } from '../tool-registry'
import type { AgentPluginDefinition, AgentPluginSnapshot } from './plugin-types'

interface PluginRuntimeState {
  definition: AgentPluginDefinition
  enabled: boolean
  toolIds: string[]
}

function cloneSnapshot(state: PluginRuntimeState): AgentPluginSnapshot {
  return {
    manifest: { ...state.definition.manifest, capabilities: [...state.definition.manifest.capabilities], permissions: [...state.definition.manifest.permissions] },
    enabled: state.enabled,
    toolIds: [...state.toolIds],
  }
}

export class AgentPluginManager {
  private readonly plugins = new Map<string, PluginRuntimeState>()
  private readonly registry: AgentToolRegistry

  constructor(registry: AgentToolRegistry) {
    this.registry = registry
  }

  register(definition: AgentPluginDefinition) {
    const id = definition.manifest.id.trim()
    if (!id) throw new Error('Plugin id is required')
    if (this.plugins.has(id)) throw new Error(`Agent plugin already registered: ${id}`)
    this.plugins.set(id, { definition, enabled: false, toolIds: [] })
    return this
  }

  has(pluginId: string) {
    return this.plugins.has(pluginId)
  }

  list(): AgentPluginSnapshot[] {
    return Array.from(this.plugins.values())
      .map(cloneSnapshot)
      .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
  }

  inspect(pluginId: string): AgentPluginSnapshot | undefined {
    const state = this.plugins.get(pluginId)
    return state ? cloneSnapshot(state) : undefined
  }

  search(query = ''): AgentPluginSnapshot[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return this.list()
    return this.list().filter((item) => {
      const haystack = [
        item.manifest.id,
        item.manifest.name,
        item.manifest.description,
        ...item.manifest.capabilities,
      ].join(' ').toLowerCase()
      return haystack.includes(normalized)
    })
  }

  enable(pluginId: string): AgentPluginSnapshot {
    const state = this.plugins.get(pluginId)
    if (!state) throw new Error(`Unknown agent plugin: ${pluginId}`)
    if (state.enabled) return cloneSnapshot(state)

    const tools = state.definition.createTools()
    const toolIds = tools.map((tool) => tool.id)
    const duplicates = toolIds.filter((toolId, index) => toolIds.indexOf(toolId) !== index)
    if (duplicates.length > 0) throw new Error(`Plugin ${pluginId} defines duplicate tool ids: ${Array.from(new Set(duplicates)).join(', ')}`)

    const conflicts = toolIds.filter((toolId) => this.registry.has(toolId))
    if (conflicts.length > 0) {
      throw new Error(`Plugin ${pluginId} cannot enable because tools are already registered: ${conflicts.join(', ')}`)
    }

    const registered: string[] = []
    try {
      for (const tool of tools) {
        this.registry.register(tool)
        registered.push(tool.id)
      }
    } catch (error) {
      for (const toolId of registered) this.registry.unregister(toolId)
      throw error
    }

    state.enabled = true
    state.toolIds = registered
    return cloneSnapshot(state)
  }

  disable(pluginId: string): AgentPluginSnapshot {
    const state = this.plugins.get(pluginId)
    if (!state) throw new Error(`Unknown agent plugin: ${pluginId}`)
    if (!state.enabled) return cloneSnapshot(state)

    for (const toolId of state.toolIds) this.registry.unregister(toolId)
    state.enabled = false
    state.toolIds = []
    return cloneSnapshot(state)
  }

  enableDefaults() {
    for (const [pluginId, state] of this.plugins) {
      if (state.definition.enabledByDefault) this.enable(pluginId)
    }
    return this
  }
}
