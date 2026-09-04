# Target Architecture — Maximum Practical Open WebUI

- Main Open WebUI runtime: CPU-only, persistent storage at `/app/backend/data`, HTTPS endpoint.
- Intelligence layer: cloud providers; OpenRouter primary LLM gateway.
- Tooling layer: native tools + OpenAPI/MCP integrations.
- Builder layer: isolated computer/terminal environment separated from public OWUI container.
- Media layer: STT/TTS/image generation/editing/enhancement via provider adapters.
- Reliability layer: health checks, fallback, backups, restore drills, spend/rate controls.
- Mobile-first UX constraints for Android/iOS PWA.
