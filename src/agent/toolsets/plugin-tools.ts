import type { AgentTool } from '../types'
import { AgentPluginManager } from '../plugins/plugin-manager'
import { AgentToolRegistry } from '../tool-registry'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createPluginManagementTools(manager: AgentPluginManager, registry: AgentToolRegistry): AgentTool[] {
  return [
    {
      id: 'agent.search_plugins',
      name: 'Search plugins',
      description: 'Search the currently known OpenVenice plugin catalog by id, name, description, or capability. This does not install anything.',
      risk: 'read',
      permissions: [],
      inputSchema: objectSchema({ query: { type: 'string' } }),
      execute: async (input) => {
        const value = input as { query?: string }
        return { ok: true, data: manager.search(value.query ?? '') }
      },
    },
    {
      id: 'agent.inspect_plugin',
      name: 'Inspect plugin',
      description: 'Read one known plugin manifest, enabled state, permissions, capabilities, and active tool ids.',
      risk: 'read',
      permissions: [],
      inputSchema: objectSchema({ plugin_id: { type: 'string' } }, ['plugin_id']),
      execute: async (input) => {
        const value = input as { plugin_id: string }
        const plugin = manager.inspect(value.plugin_id)
        return plugin ? { ok: true, data: plugin } : { ok: false, error: `Unknown plugin: ${value.plugin_id}` }
      },
    },
    {
      id: 'agent.enable_plugin',
      name: 'Enable plugin',
      description: 'Enable a known already-installed OpenVenice plugin and register its agent tools. This does not download packages or bypass Android install confirmation.',
      risk: 'write',
      permissions: [],
      inputSchema: objectSchema({ plugin_id: { type: 'string' } }, ['plugin_id']),
      execute: async (input) => {
        const value = input as { plugin_id: string }
        try {
          return { ok: true, data: manager.enable(value.plugin_id) }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      id: 'agent.disable_plugin',
      name: 'Disable plugin',
      description: 'Disable a known OpenVenice plugin and unregister its agent tools. Plugin files are not deleted.',
      risk: 'write',
      permissions: [],
      inputSchema: objectSchema({ plugin_id: { type: 'string' } }, ['plugin_id']),
      execute: async (input) => {
        const value = input as { plugin_id: string }
        try {
          return { ok: true, data: manager.disable(value.plugin_id) }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      id: 'agent.list_tools',
      name: 'List agent tools',
      description: 'List the agent tools currently registered and available for Qwen to call.',
      risk: 'read',
      permissions: [],
      inputSchema: objectSchema({}),
      execute: async () => ({ ok: true, data: registry.list() }),
    },
  ]
}
