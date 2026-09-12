# Shahy host connectors

Shahy’s GitHub, Microsoft Graph, and research tools talk to same-origin proxies. Secrets stay on the OpenVenice host.

## Status

`GET /connectors/status` returns:

```json
{ "github": true, "graph": false, "exa": true, "tavily": false }
```

Booleans mean “host token present”, not “upstream is healthy”. `research.status` exposes this to Qwen without leaking tokens.

## Environment

| Variable | Proxy | Upstream |
|---|---|---|
| `GITHUB_CONNECTOR_TOKEN` (or `GITHUB_TOKEN`) | `/connectors/github/` | `https://api.github.com/` |
| `MICROSOFT_GRAPH_TOKEN` | `/connectors/graph/` | `https://graph.microsoft.com/v1.0/` |
| `EXA_API_KEY` | `/connectors/exa/` | `https://api.exa.ai/` |
| `TAVILY_API_KEY` | `/connectors/tavily/` | `https://api.tavily.com/` |

Never set these as `VITE_*` variables.

GitHub should be a fine-grained PAT with read access to the repositories Shahy may inspect. Microsoft Graph should be a delegated token with the least-privilege read scopes Shahy actually uses (`Mail.Read`, `Calendars.Read`, `Contacts.Read`, `Files.Read`, `Sites.Read.All`). Refresh Graph tokens out of band; this proxy does not implement OAuth.

Unconfigured prefixes return HTTP 503. Configured prefixes strip inbound `Cookie` / `Authorization` and inject the host token.

## Agent tools

- GitHub: `github.whoami`, `github.search_repositories`, `github.get_repository`, `github.list_issues`, `github.get_issue`, `github.list_pulls`, `github.get_pull`, `github.list_commits`, `github.ci_status`
- Microsoft Graph: `graph.whoami`, `graph.list_mail`, `graph.get_message`, `graph.list_calendar`, `graph.list_contacts`, `graph.list_drive`, `graph.search_sharepoint`
- Research: `research.status`, `research.search`, `research.fetch`

All of these are read-only. `research.fetch` rejects localhost, private, metadata, and credentialed URLs before any provider call.
