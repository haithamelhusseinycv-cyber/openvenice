export type ToolRisk = 'read' | 'write' | 'destructive'

export type ToolPermission =
  | 'network'
  | 'local-files'
  | 'local-app-control'
  | 'account-read'
  | 'account-write'
  | 'install-package'

export interface AgentToolContext {
  signal?: AbortSignal
  conversationId?: string
  jobId?: string
}

export interface AgentToolResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  metadata?: Record<string, unknown>
}

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  id: string
  name: string
  description: string
  risk: ToolRisk
  permissions: ToolPermission[]
  inputSchema: Record<string, unknown>
  execute: (input: TInput, context: AgentToolContext) => Promise<AgentToolResult<TOutput>>
}

export interface AgentToolDescriptor {
  id: string
  name: string
  description: string
  risk: ToolRisk
  permissions: ToolPermission[]
  inputSchema: Record<string, unknown>
}

export function describeTool(tool: AgentTool): AgentToolDescriptor {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    risk: tool.risk,
    permissions: tool.permissions,
    inputSchema: tool.inputSchema,
  }
}
