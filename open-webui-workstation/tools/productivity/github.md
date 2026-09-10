# GitHub Productivity Integration

Scope:
- Repository search
- PR/issue/commit insight
- CI/CD status and logs

Implementation:
- Plugin id `github` (enabled by default)
- Browser client: `src/connectors/github/github-connector.ts`
- Same-origin proxy: `/connectors/github/` → `https://api.github.com/`
- Agent tools: `github.whoami`, `github.search_repositories`, `github.get_repository`, `github.list_issues`, `github.get_issue`, `github.list_pulls`, `github.get_pull`, `github.list_commits`, `github.ci_status`

Security:
- Server-side token only (`GITHUB_CONNECTOR_TOKEN` or `GITHUB_TOKEN`)
- No token exposure in model context or `VITE_*` bundle vars
- Proxy strips inbound `Authorization` / `Cookie` and injects the host token
- Read-only (GET/HEAD)

Validation:
- `GET /connectors/status` shows `"github": true` when the token is set
- `github.whoami` succeeds against the authenticated API
