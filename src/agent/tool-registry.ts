import {
  describeTool,
  type AgentTool,
  type AgentToolContext,
  type AgentToolDescriptor,
  type AgentToolResult,
  type ToolPermission,
} from './types'

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentTool>()

  register(tool: AgentTool) {
    if (this.tools.has(tool.id)) {
      throw new Error(`Agent tool already registered: ${tool.id}`)
    }
    this.tools.set(tool.id, tool)
    return this
  }

  unregister(toolId: string) {
    this.tools.delete(toolId)
  }

  has(toolId: string) {
    return this.tools.has(toolId)
  }

  list(): AgentToolDescriptor[] {
    return Array.from(this.tools.values()).map(describeTool)
  }

  findByPermission(permission: ToolPermission): AgentToolDescriptor[] {
    return this.list().filter((tool) => tool.permissions.includes(permission))
  }

  async execute<T = unknown>(
    toolId: string,
    input: unknown,
    context: AgentToolContext = {},
  ): Promise<AgentToolResult<T>> {
    const tool = this.tools.get(toolId)
    if (!tool) {
      return { ok: false, error: `Unknown agent tool: ${toolId}` }
    }

    try {
      return (await tool.execute(input, context)) as AgentToolResult<T>
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
