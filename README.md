# OpenVenice — Focused Custom Build

A self-hosted React frontend for the Venice AI API, customized around a small allowlist of chat, still-image generation, image-editing, workflow, and workflow-agent features.

This fork intentionally hides Audio, Music, Video, and Embeddings from the application surface. Model IDs and defaults are centralized in `src/lib/allowed-models.ts` so UI, settings, Workflows, and Playground follow the same policy.

## Enabled surfaces

### Chat

Streaming chat, conversation history, image attachments, configurable generation settings, Markdown rendering, and Venice web-search options where supported by the selected model.

Allowlisted chat models:

- `venice-uncensored-1-2` — default
- `venice-uncensored-role-play`
- `qwen-3-6-plus`
- `olafangensan-glm-4-7-flash-heretic`

Default maximum output is 1024 tokens unless the user changes it.

### Image Generate

Allowlisted generators:

- `lustify-v8` — default
- `lustify-v7`
- `lustify-sdxl`

The generator keeps prompt and negative-prompt text locally, supports model-advertised aspect ratios/resolutions, limits variants to two, caps the in-session gallery, and downloads images with a MIME-aware extension.

### Image Tools

Tools include Edit, Swap, Undress, Upscale, and Background Remove. Edit uses:

- `qwen-edit-uncensored` — default
- `firered-image-edit`

Edit / Swap / Undress use Venice `/image/multi-edit`. Requests keep `safe_mode: false` and `enhance_prompt: false`; this fork does not add a `moderation` field. Multi-edit uploads are restricted to JPEG, PNG, WebP, or GIF, under 25 MB, with preflight image validation.

Generate results can be handed directly to Edit or Swap. The Undress workflow requires an adult/permission confirmation before the action is enabled.

### Workflows

The visual workflow editor exposes only:

- Input
- Chat
- Image Gen
- Output

Legacy saved TTS/Music/Video nodes can still be rendered as unsupported nodes so users can remove them, but validation/execution will not run them.

### Playground

The workflow agent can create and edit the same restricted workflow graph. Its model picker and model-discovery tools use the centralized allowlist, and agent responses are capped at 1536 tokens.

## API reliability

The Venice client distinguishes safe reads from billable mutations:

- GET/HEAD requests may retry transient server/network failures.
- Paid POST operations default to zero automatic retries to avoid accidental duplicate generations.
- HTTP 429 is surfaced to the user rather than automatically replaying a mutation.
- Error parsing handles Venice object errors, flat `{ "error": "..." }` responses, top-level messages, and plain text.

## API key storage

By default the Venice API key is kept in `sessionStorage`, so it disappears when the browser session closes.

If **Remember across sessions** is enabled, the key is encrypted in-browser with AES-GCM using a passphrase-derived key (PBKDF2) before being stored in `localStorage`. The passphrase itself is not persisted.

## Development

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

Pull requests also run the same lint/build gate through GitHub Actions.

## Production / Railway

The repository includes a multi-stage Docker build and `railway.json`.

```bash
docker build -t openvenice .
docker run --rm -p 8080:80 openvenice
```

The runtime Nginx configuration provides SPA fallback, cache rules, CSP, clickjacking protection, MIME sniffing protection, referrer policy, and a restrictive permissions policy.

The default production API endpoint is:

```text
https://api.venice.ai/api/v1
```

You can override it at build time:

```bash
docker build \
  --build-arg VITE_VENICE_BASE_URL=https://example.com/api/v1 \
  -t openvenice .
```

If the override points to a different external origin, add that origin to `connect-src` in both `index.html` and `nginx.conf`. A same-origin proxy is preferable when the API key should be injected server-side.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + N` | New chat |
| `Cmd/Ctrl + 1–4` | Switch enabled tabs |
| `Enter` | Send in Chat |
| `Shift + Enter` | Newline |
| `Esc` | Close supported dialogs/lightboxes |

## Architecture

```text
src/
├── components/
│   ├── chat/
│   ├── image/
│   ├── workflows/
│   ├── playground/
│   ├── layout/
│   └── ui/
├── hooks/
├── lib/
│   ├── allowed-models.ts
│   ├── image-io.ts
│   ├── venice-client.ts
│   ├── workflow-engine.ts
│   ├── workflow-schema.ts
│   ├── workflow-validator.ts
│   └── playground-agent-tools.ts
├── stores/
└── types/
```

The source tree still contains some upstream components for disabled modalities so the fork can be rebased more easily, but those surfaces are not exposed by the customized application routing.

## Security notes

- Browser-rendered model Markdown uses a URL allowlist.
- Production CSP is sent as an HTTP response header by Nginx; a compatible meta CSP remains for static-host fallbacks.
- Persisted Zustand stores are versioned and quota-safe.
- Blob preview URLs are revoked on replacement/unmount.
- Do not commit API keys or `.env` secrets; environment files are ignored except `.env.example`.

## Tech stack

React 19, TypeScript, Vite, Zustand, TanStack Query, Tailwind CSS v4, React Flow, Nginx.

## License

MIT
