import type { ConnectorHttpTransport } from '../http-transport'
import { FetchHttpTransport } from '../http-transport'

export interface GraphConnectorOptions {
  baseUrl?: string
  transport?: ConnectorHttpTransport
}

export interface GraphUser {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
}

export interface GraphMessage {
  id: string
  subject?: string
  from?: string
  receivedDateTime?: string
  isRead?: boolean
  bodyPreview?: string
}

export interface GraphEvent {
  id: string
  subject?: string
  start?: string
  end?: string
  location?: string
  webLink?: string
}

export interface GraphContact {
  id: string
  displayName?: string
  email?: string
  company?: string
}

export interface GraphDriveItem {
  id: string
  name?: string
  webUrl?: string
  size?: number
  folder?: boolean
}

export interface GraphSite {
  id: string
  name?: string
  webUrl?: string
  displayName?: string
}

function trimBase(value: string) {
  return value.replace(/\/+$/, '')
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export class GraphConnector {
  readonly baseUrl: string
  private readonly transport: ConnectorHttpTransport

  constructor(options: GraphConnectorOptions = {}) {
    this.baseUrl = trimBase(options.baseUrl || '/connectors/graph')
    this.transport = options.transport || new FetchHttpTransport()
  }

  private path(path: string, params?: Record<string, string | number | undefined>) {
    return `${this.baseUrl}${path}${params ? queryString(params) : ''}`
  }

  async whoami(signal?: AbortSignal): Promise<GraphUser> {
    const data = await this.transport.requestJson<{
      id: string
      displayName?: string
      mail?: string | null
      userPrincipalName?: string
    }>(this.path('/me', { $select: 'id,displayName,mail,userPrincipalName' }), { signal })
    return {
      id: data.id,
      displayName: data.displayName,
      mail: data.mail,
      userPrincipalName: data.userPrincipalName,
    }
  }

  async listMail(top = 10, search?: string, signal?: AbortSignal): Promise<GraphMessage[]> {
    const data = await this.transport.requestJson<{
      value?: Array<{
        id: string
        subject?: string
        from?: { emailAddress?: { address?: string; name?: string } }
        receivedDateTime?: string
        isRead?: boolean
        bodyPreview?: string
      }>
    }>(
      this.path('/me/messages', {
        $top: top,
        $select: 'id,subject,from,receivedDateTime,isRead,bodyPreview',
        $search: search ? `"${search.replace(/"/g, '')}"` : undefined,
      }),
      {
        signal,
        headers: search ? { ConsistencyLevel: 'eventual' } : undefined,
      },
    )
    return (data.value || []).map((item) => ({
      id: item.id,
      subject: item.subject,
      from: item.from?.emailAddress?.address || item.from?.emailAddress?.name,
      receivedDateTime: item.receivedDateTime,
      isRead: item.isRead,
      bodyPreview: item.bodyPreview,
    }))
  }

  async getMessage(id: string, signal?: AbortSignal): Promise<GraphMessage & { body?: string }> {
    const data = await this.transport.requestJson<{
      id: string
      subject?: string
      from?: { emailAddress?: { address?: string; name?: string } }
      receivedDateTime?: string
      isRead?: boolean
      bodyPreview?: string
      body?: { content?: string }
    }>(
      this.path(`/me/messages/${encodeURIComponent(id)}`, {
        $select: 'id,subject,from,receivedDateTime,isRead,bodyPreview,body',
      }),
      { signal },
    )
    return {
      id: data.id,
      subject: data.subject,
      from: data.from?.emailAddress?.address || data.from?.emailAddress?.name,
      receivedDateTime: data.receivedDateTime,
      isRead: data.isRead,
      bodyPreview: data.bodyPreview,
      body: data.body?.content,
    }
  }

  async listCalendar(top = 10, start?: string, end?: string, signal?: AbortSignal): Promise<GraphEvent[]> {
    const params: Record<string, string | number | undefined> = {
      $top: top,
      $select: 'id,subject,start,end,location,webLink',
      $orderby: 'start/dateTime',
    }
    const path = start && end ? '/me/calendarView' : '/me/events'
    if (start && end) {
      params.startDateTime = start
      params.endDateTime = end
    }
    const data = await this.transport.requestJson<{
      value?: Array<{
        id: string
        subject?: string
        start?: { dateTime?: string }
        end?: { dateTime?: string }
        location?: { displayName?: string }
        webLink?: string
      }>
    }>(this.path(path, params), { signal })
    return (data.value || []).map((item) => ({
      id: item.id,
      subject: item.subject,
      start: item.start?.dateTime,
      end: item.end?.dateTime,
      location: item.location?.displayName,
      webLink: item.webLink,
    }))
  }

  async listContacts(top = 10, signal?: AbortSignal): Promise<GraphContact[]> {
    const data = await this.transport.requestJson<{
      value?: Array<{
        id: string
        displayName?: string
        emailAddresses?: Array<{ address?: string }>
        companyName?: string
      }>
    }>(
      this.path('/me/contacts', {
        $top: top,
        $select: 'id,displayName,emailAddresses,companyName',
      }),
      { signal },
    )
    return (data.value || []).map((item) => ({
      id: item.id,
      displayName: item.displayName,
      email: item.emailAddresses?.[0]?.address,
      company: item.companyName,
    }))
  }

  async listDrive(top = 10, signal?: AbortSignal): Promise<GraphDriveItem[]> {
    const data = await this.transport.requestJson<{
      value?: Array<{
        id: string
        name?: string
        webUrl?: string
        size?: number
        folder?: unknown
      }>
    }>(this.path('/me/drive/root/children', { $top: top, $select: 'id,name,webUrl,size,folder' }), { signal })
    return (data.value || []).map((item) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size,
      folder: Boolean(item.folder),
    }))
  }

  async searchSharePoint(query: string, signal?: AbortSignal): Promise<GraphSite[]> {
    const data = await this.transport.requestJson<{
      value?: Array<{
        id: string
        name?: string
        displayName?: string
        webUrl?: string
      }>
    }>(this.path('/sites', { search: query }), { signal })
    return (data.value || []).map((item) => ({
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      webUrl: item.webUrl,
    }))
  }
}
