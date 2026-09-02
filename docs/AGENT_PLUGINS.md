# OpenVenice agent plugins

The plugin manager is the control plane for tools that Qwen can discover and enable/disable.

## Current foundation

Built-in plugins:

- **Local Dream** — enabled by default; generation, img2img, inpaint, model control, and upscale.
- **FaceFusion** — enabled by default only in native Android when the signature-protected bridge is available.

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
