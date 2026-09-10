import type { ConnectorHttpTransport } from '../http-transport'
import { FetchHttpTransport } from '../http-transport'

export interface GithubConnectorOptions {
  baseUrl?: string
  transport?: ConnectorHttpTransport
}

export interface GithubUser {
  login: string
  name?: string | null
  htmlUrl?: string
}

export interface GithubRepository {
  fullName: string
  description?: string | null
  htmlUrl: string
  defaultBranch?: string
  private?: boolean
}

export interface GithubIssue {
  number: number
  title: string
  state: string
  htmlUrl: string
  user?: string
  updatedAt?: string
}

export interface GithubPull {
  number: number
  title: string
  state: string
  htmlUrl: string
  user?: string
  draft?: boolean
  updatedAt?: string
}

export interface GithubCommit {
  sha: string
  message: string
  htmlUrl: string
  author?: string
  date?: string
}

export interface GithubCheck {
  name: string
  status: string
  conclusion?: string | null
  htmlUrl?: string
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

export class GithubConnector {
  readonly baseUrl: string
  private readonly transport: ConnectorHttpTransport

  constructor(options: GithubConnectorOptions = {}) {
    this.baseUrl = trimBase(options.baseUrl || '/connectors/github')
    this.transport = options.transport || new FetchHttpTransport()
  }

  private path(path: string, params?: Record<string, string | number | undefined>) {
    return `${this.baseUrl}${path}${params ? queryString(params) : ''}`
  }

  async whoami(signal?: AbortSignal): Promise<GithubUser> {
    const data = await this.transport.requestJson<{
      login: string
      name?: string | null
      html_url?: string
    }>(this.path('/user'), { signal })
    return { login: data.login, name: data.name, htmlUrl: data.html_url }
  }

  async searchRepositories(query: string, perPage = 5, signal?: AbortSignal): Promise<GithubRepository[]> {
    const data = await this.transport.requestJson<{
      items?: Array<{
        full_name: string
        description?: string | null
        html_url: string
        default_branch?: string
        private?: boolean
      }>
    }>(this.path('/search/repositories', { q: query, per_page: perPage }), { signal })
    return (data.items || []).map((item) => ({
      fullName: item.full_name,
      description: item.description,
      htmlUrl: item.html_url,
      defaultBranch: item.default_branch,
      private: item.private,
    }))
  }

  async getRepository(owner: string, repo: string, signal?: AbortSignal): Promise<GithubRepository> {
    const data = await this.transport.requestJson<{
      full_name: string
      description?: string | null
      html_url: string
      default_branch?: string
      private?: boolean
    }>(this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`), { signal })
    return {
      fullName: data.full_name,
      description: data.description,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch,
      private: data.private,
    }
  }

  async listIssues(
    owner: string,
    repo: string,
    state = 'open',
    perPage = 10,
    signal?: AbortSignal,
  ): Promise<GithubIssue[]> {
    const data = await this.transport.requestJson<Array<{
      number: number
      title: string
      state: string
      html_url: string
      pull_request?: unknown
      user?: { login?: string }
      updated_at?: string
    }>>(
      this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
        state,
        per_page: perPage,
      }),
      { signal },
    )
    return data
      .filter((item) => !item.pull_request)
      .map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        htmlUrl: item.html_url,
        user: item.user?.login,
        updatedAt: item.updated_at,
      }))
  }

  async getIssue(owner: string, repo: string, number: number, signal?: AbortSignal): Promise<GithubIssue & { body?: string | null }> {
    const data = await this.transport.requestJson<{
      number: number
      title: string
      state: string
      html_url: string
      body?: string | null
      user?: { login?: string }
      updated_at?: string
    }>(this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`), { signal })
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      htmlUrl: data.html_url,
      user: data.user?.login,
      updatedAt: data.updated_at,
      body: data.body,
    }
  }

  async listPulls(
    owner: string,
    repo: string,
    state = 'open',
    perPage = 10,
    signal?: AbortSignal,
  ): Promise<GithubPull[]> {
    const data = await this.transport.requestJson<Array<{
      number: number
      title: string
      state: string
      html_url: string
      draft?: boolean
      user?: { login?: string }
      updated_at?: string
    }>>(
      this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
        state,
        per_page: perPage,
      }),
      { signal },
    )
    return data.map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      htmlUrl: item.html_url,
      user: item.user?.login,
      draft: item.draft,
      updatedAt: item.updated_at,
    }))
  }

  async getPull(owner: string, repo: string, number: number, signal?: AbortSignal): Promise<GithubPull & { body?: string | null }> {
    const data = await this.transport.requestJson<{
      number: number
      title: string
      state: string
      html_url: string
      draft?: boolean
      body?: string | null
      user?: { login?: string }
      updated_at?: string
    }>(this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`), { signal })
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      htmlUrl: data.html_url,
      user: data.user?.login,
      draft: data.draft,
      updatedAt: data.updated_at,
      body: data.body,
    }
  }

  async listCommits(owner: string, repo: string, sha?: string, perPage = 10, signal?: AbortSignal): Promise<GithubCommit[]> {
    const data = await this.transport.requestJson<Array<{
      sha: string
      html_url: string
      commit?: { message?: string; author?: { name?: string; date?: string } }
    }>>(
      this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`, {
        sha,
        per_page: perPage,
      }),
      { signal },
    )
    return data.map((item) => ({
      sha: item.sha,
      message: item.commit?.message?.split('\n')[0] || '',
      htmlUrl: item.html_url,
      author: item.commit?.author?.name,
      date: item.commit?.author?.date,
    }))
  }

  async getCiStatus(owner: string, repo: string, ref = 'HEAD', signal?: AbortSignal): Promise<GithubCheck[]> {
    const data = await this.transport.requestJson<{
      check_runs?: Array<{
        name: string
        status: string
        conclusion?: string | null
        html_url?: string
      }>
    }>(
      this.path(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}/check-runs`, {
        per_page: 20,
      }),
      { signal },
    )
    return (data.check_runs || []).map((item) => ({
      name: item.name,
      status: item.status,
      conclusion: item.conclusion,
      htmlUrl: item.html_url,
    }))
  }
}
