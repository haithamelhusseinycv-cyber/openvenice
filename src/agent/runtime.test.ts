import { describe, expect, it } from 'vitest'
import { createAgentRuntime } from './runtime'

describe('createAgentRuntime', () => {
  it('enables Local Dream plus the Shahy host connectors by default', () => {
    const runtime = createAgentRuntime()
    expect(runtime.plugins.inspect('localdream')?.enabled).toBe(true)
    expect(runtime.plugins.inspect('github')?.enabled).toBe(true)
    expect(runtime.plugins.inspect('microsoft-graph')?.enabled).toBe(true)
    expect(runtime.plugins.inspect('research')?.enabled).toBe(true)
    expect(runtime.plugins.inspect('facefusion')).toBeUndefined()

    expect(runtime.registry.has('github.search_repositories')).toBe(true)
    expect(runtime.registry.has('graph.list_mail')).toBe(true)
    expect(runtime.registry.has('research.search')).toBe(true)
    expect(runtime.registry.has('agent.list_tools')).toBe(true)
  })

  it('can disable a host connector without dropping the others', () => {
    const runtime = createAgentRuntime()
    runtime.plugins.disable('github')
    expect(runtime.registry.has('github.whoami')).toBe(false)
    expect(runtime.registry.has('research.search')).toBe(true)
    expect(runtime.plugins.search('mail')[0]?.manifest.id).toBe('microsoft-graph')
  })
})
