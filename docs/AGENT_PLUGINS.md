# OpenVenice agent plugins

The plugin manager is the control plane for tools that Qwen can discover and enable/disable.

## Current foundation

Built-in plugins:

- **Local Dream** — enabled by default; generation, img2img, inpaint, model control, and upscale.
- **FaceFusion** — enabled by default only in native Android when the signature-protected bridge is available.
- **GitHub** — enabled by default; read-only repo, issue, pull, commit, and CI insight through `/connectors/github`. Requires `GITHUB_CONNECTOR_TOKEN` or `GITHUB_TOKEN` on the host.
- **Microsoft Graph** — enabled by default; read-only Outlook mail, calendar, contacts, OneDrive, and SharePoint through `/connectors/graph`. Requires `MICROSOFT_GRAPH_TOKEN` on the host.
- **Research** — enabled by default; Exa search/contents with Tavily fallback through `/connectors/exa` and `/connectors/tavily`. Requires `EXA_API_KEY` or `TAVILY_API_KEY` on the host.

Host tokens are injected by Nginx in production and the Vite proxy in development. They never enter a `VITE_*` variable, the browser bundle, or model context. Unconfigured connectors fail closed with HTTP 503. `research.status` reports which connectors are configured without exposing secrets.

Agent management tools:

- `agent.search_plugins`
- `agent.inspect_plugin`
- `agent.enable_plugin`
- `agent.disable_plugin`
- `agent.list_tools`

Tool bindings are rebuilt every Qwen planning round, so enabling or disabling a known plugin changes the tools available on the next round of the same agent run.

## Security boundary

This phase does **not** download or execute arbitrary plugin code. Enabling a plugin only registers tools from a plugin definition already present in the trusted OpenVenice build. Disabling removes those tools without deleting files.

The manifest already has fields for `sourceUrl`, `sha256`, and `signature`. A later signed-catalog phase can add installation/update only after package verification and explicit permission handling. Android APK/package installation will continue to require normal platform confirmation unless the device has separately configured device-owner/system privileges.
