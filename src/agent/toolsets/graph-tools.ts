import type { AgentTool } from '../types'
import { GraphConnector } from '../../connectors/microsoft-graph/graph-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createGraphTools(connector = new GraphConnector()): AgentTool[] {
  return [
    {
      id: 'graph.whoami',
      name: 'Microsoft Graph identity',
      description: 'Read the signed-in Microsoft account used by the host-side Graph connector. Fails closed if MICROSOFT_GRAPH_TOKEN is not configured. Never returns the token.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({}),
      execute: async (_input, context) => ({ ok: true, data: await connector.whoami(context.signal) }),
    },
    {
      id: 'graph.list_mail',
      name: 'List Outlook mail',
      description: 'List recent Outlook messages. Read-only. Optional search uses Graph $search.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({
        top: { type: 'integer', minimum: 1, maximum: 25 },
        search: { type: 'string' },
      }),
      execute: async (input, context) => {
        const value = input as { top?: number; search?: string }
        return { ok: true, data: await connector.listMail(value.top ?? 10, value.search, context.signal) }
      },
    },
    {
      id: 'graph.get_message',
      name: 'Get Outlook message',
      description: 'Read one Outlook message by id, including body text. Read-only.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({ id: { type: 'string' } }, ['id']),
      execute: async (input, context) => {
        const value = input as { id: string }
        return { ok: true, data: await connector.getMessage(value.id, context.signal) }
      },
    },
    {
      id: 'graph.list_calendar',
      name: 'List Outlook calendar',
      description: 'List Outlook events. Provide start and end as ISO-8601 timestamps to use calendarView.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({
        top: { type: 'integer', minimum: 1, maximum: 25 },
        start: { type: 'string' },
        end: { type: 'string' },
      }),
      execute: async (input, context) => {
        const value = input as { top?: number; start?: string; end?: string }
        return { ok: true, data: await connector.listCalendar(value.top ?? 10, value.start, value.end, context.signal) }
      },
    },
    {
      id: 'graph.list_contacts',
      name: 'List Outlook contacts',
      description: 'List Outlook contacts. Read-only.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({ top: { type: 'integer', minimum: 1, maximum: 25 } }),
      execute: async (input, context) => {
        const value = input as { top?: number }
        return { ok: true, data: await connector.listContacts(value.top ?? 10, context.signal) }
      },
    },
    {
      id: 'graph.list_drive',
      name: 'List OneDrive root',
      description: 'List items in the signed-in user OneDrive root. Read-only.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({ top: { type: 'integer', minimum: 1, maximum: 25 } }),
      execute: async (input, context) => {
        const value = input as { top?: number }
        return { ok: true, data: await connector.listDrive(value.top ?? 10, context.signal) }
      },
    },
    {
      id: 'graph.search_sharepoint',
      name: 'Search SharePoint sites',
      description: 'Search SharePoint sites visible to the signed-in account. Read-only.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({ query: { type: 'string' } }, ['query']),
      execute: async (input, context) => {
        const value = input as { query: string }
        return { ok: true, data: await connector.searchSharePoint(value.query, context.signal) }
      },
    },
  ]
}
