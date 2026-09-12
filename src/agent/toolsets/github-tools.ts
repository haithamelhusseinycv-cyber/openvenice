import type { AgentTool } from '../types'
import { GithubConnector } from '../../connectors/github/github-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createGithubTools(connector = new GithubConnector()): AgentTool[] {
  return [
    {
      id: 'github.whoami',
      name: 'GitHub identity',
      description: 'Read the authenticated GitHub account used by the host-side GitHub connector. Fails closed if GITHUB_TOKEN is not configured. Never returns the token.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({}),
      execute: async (_input, context) => ({ ok: true, data: await connector.whoami(context.signal) }),
    },
    {
      id: 'github.search_repositories',
      name: 'Search GitHub repositories',
      description: 'Search repositories visible to the host GitHub token.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          query: { type: 'string' },
          per_page: { type: 'integer', minimum: 1, maximum: 20 },
        },
        ['query'],
      ),
      execute: async (input, context) => {
        const value = input as { query: string; per_page?: number }
        return { ok: true, data: await connector.searchRepositories(value.query, value.per_page ?? 5, context.signal) }
      },
    },
    {
      id: 'github.get_repository',
      name: 'Get GitHub repository',
      description: 'Read one repository by owner and name.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema({ owner: { type: 'string' }, repo: { type: 'string' } }, ['owner', 'repo']),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string }
        return { ok: true, data: await connector.getRepository(value.owner, value.repo, context.signal) }
      },
    },
    {
      id: 'github.list_issues',
      name: 'List GitHub issues',
      description: 'List issues in a repository. Pull requests are excluded.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { enum: ['open', 'closed', 'all'] },
          per_page: { type: 'integer', minimum: 1, maximum: 50 },
        },
        ['owner', 'repo'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; state?: string; per_page?: number }
        return {
          ok: true,
          data: await connector.listIssues(value.owner, value.repo, value.state ?? 'open', value.per_page ?? 10, context.signal),
        }
      },
    },
    {
      id: 'github.get_issue',
      name: 'Get GitHub issue',
      description: 'Read one issue or pull-request-as-issue by number, including body text.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          number: { type: 'integer', minimum: 1 },
        },
        ['owner', 'repo', 'number'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; number: number }
        return { ok: true, data: await connector.getIssue(value.owner, value.repo, value.number, context.signal) }
      },
    },
    {
      id: 'github.list_pulls',
      name: 'List GitHub pull requests',
      description: 'List pull requests in a repository.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { enum: ['open', 'closed', 'all'] },
          per_page: { type: 'integer', minimum: 1, maximum: 50 },
        },
        ['owner', 'repo'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; state?: string; per_page?: number }
        return {
          ok: true,
          data: await connector.listPulls(value.owner, value.repo, value.state ?? 'open', value.per_page ?? 10, context.signal),
        }
      },
    },
    {
      id: 'github.get_pull',
      name: 'Get GitHub pull request',
      description: 'Read one pull request by number, including body text.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          number: { type: 'integer', minimum: 1 },
        },
        ['owner', 'repo', 'number'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; number: number }
        return { ok: true, data: await connector.getPull(value.owner, value.repo, value.number, context.signal) }
      },
    },
    {
      id: 'github.list_commits',
      name: 'List GitHub commits',
      description: 'List recent commits on a repository or branch.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          sha: { type: 'string', description: 'Branch, tag, or commit SHA.' },
          per_page: { type: 'integer', minimum: 1, maximum: 50 },
        },
        ['owner', 'repo'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; sha?: string; per_page?: number }
        return {
          ok: true,
          data: await connector.listCommits(value.owner, value.repo, value.sha, value.per_page ?? 10, context.signal),
        }
      },
    },
    {
      id: 'github.ci_status',
      name: 'GitHub CI status',
      description: 'Read check runs for a commit, branch, or tag.',
      risk: 'read',
      permissions: ['network', 'account-read'],
      inputSchema: objectSchema(
        {
          owner: { type: 'string' },
          repo: { type: 'string' },
          ref: { type: 'string', description: 'Commit SHA, branch, or tag. Defaults to HEAD.' },
        },
        ['owner', 'repo'],
      ),
      execute: async (input, context) => {
        const value = input as { owner: string; repo: string; ref?: string }
        return { ok: true, data: await connector.getCiStatus(value.owner, value.repo, value.ref ?? 'HEAD', context.signal) }
      },
    },
  ]
}
