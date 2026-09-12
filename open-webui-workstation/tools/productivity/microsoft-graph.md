# Microsoft Graph Productivity Integration

Scope:
- Outlook Mail
- Calendar
- Contacts
- OneDrive
- SharePoint

Implementation:
- Plugin id `microsoft-graph` (enabled by default)
- Browser client: `src/connectors/microsoft-graph/graph-connector.ts`
- Same-origin proxy: `/connectors/graph/` → `https://graph.microsoft.com/v1.0/`
- Agent tools: `graph.whoami`, `graph.list_mail`, `graph.get_message`, `graph.list_calendar`, `graph.list_contacts`, `graph.list_drive`, `graph.search_sharepoint`

Security:
- OAuth access token stored server-side as `MICROSOFT_GRAPH_TOKEN`
- Least-privilege read scopes
- No raw token disclosure
- Read-only (GET/HEAD)
- Token refresh is out of band; this proxy does not implement OAuth

Validation:
- `GET /connectors/status` shows `"graph": true` when the token is set
- `graph.whoami` succeeds
- Read/list operation verified per service
