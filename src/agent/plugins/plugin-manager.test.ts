import { describe, expect, it } from 'vitest'
import { AgentToolRegistry } from '../tool-registry'
import type { AgentPluginDefinition } from './plugin-types'
import { AgentPluginManager } from './plugin-manager'

function fakePlugin(id = 'demo'): AgentPluginDefinition {
  return {
    manifest: {
      id,
      name: 'Demo plugin',
      version: '1.0.0',
      description: 'A deterministic test plugin.',
      capabilities: ['test'],
      permissions: [],
      entrypoint: 'test:demo',
    },
    createTools: () => [
      {
        id: `${id}.ping`,
        name: 'Ping',
        description: 'Return pong.',
        risk: 'read',
        permissions: [],
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => ({ ok: true, data: 'pong' }),
      },
    ],
  }
}

describe('AgentPluginManager', () => {
  it('registers, enables, searches, and disables a plugin without leaving tools behind', async () => {
    const registry = new AgentToolRegistry()
    const manager = new AgentPluginManager(registry)
    manager.register(fakePlugin())

    expect(manager.inspect('demo')?.enabled).toBe(false)
    expect(manager.search('deterministic')[0]?.manifest.id).toBe('demo')

    const enabled = manager.enable('demo')
    expect(enabled.enabled).toBe(true)
    expect(registry.has('demo.ping')).toBe(true)
    await expect(registry.execute('demo.ping', {})).resolves.toMatchObject({ ok: true, data: 'pong' })

    const disabled = manager.disable('demo')
    expect(disabled.enabled).toBe(false)
    expect(registry.has('demo.ping')).toBe(false)
  })

  it('refuses to enable a plugin when one of its tool ids is already registered', () => {
    const registry = new AgentToolRegistry()
    registry.register(fakePlugin('demo').createTools()[0])
    const manager = new AgentPluginManager(registry)
    manager.register(fakePlugin('demo'))

    expect(() => manager.enable('demo')).toThrow(/already registered/)
    expect(manager.inspect('demo')?.enabled).toBe(false)
  })
})
