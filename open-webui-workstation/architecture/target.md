# Target Architecture — Maximum Practical Open WebUI

- Main Open WebUI runtime: CPU-only, persistent storage at `/app/backend/data`, HTTPS endpoint.
- Intelligence layer: OpenCode Zen Responses API with a curated four-model catalog.
- Tooling layer: native tools + OpenAPI/MCP integrations.
- Builder layer: a dedicated, API-key-protected Open Terminal pod with its own
  persistent volume, separated from the public Open WebUI container.
- Media layer: STT/TTS/image generation/editing/enhancement via provider adapters.
- Reliability layer: health checks, fallback, backups, restore drills, spend/rate controls.
- Mobile-first UX constraints for Android/iOS PWA.

The observed production state is recorded in `runtime/live-state.yaml`. Target
architecture statements are not evidence that a component has been deployed.
