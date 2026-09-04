# Maximum Practical Open WebUI Workstation

Standalone architecture package for a private, mobile-first AI workstation on **Open WebUI v0.11.3**.

This package is **not** tied to any other frontend project. It configures Open WebUI + optional isolated Computer/Open Terminal tooling.

## Live target (current)

| Item | Value |
|------|--------|
| Pod ID | `c7togjwbwnqjqi` |
| URL | https://c7togjwbwnqjqi-8080.proxy.runpod.net |
| Image | `ghcr.io/open-webui/open-webui:v0.11.3` |
| Compute | CPU-only |
| Volume | `i6b6qi97gx` → `/app/backend/data` |
| Port | 8080/http |

## Status snapshot

See [docs/STATUS.md](docs/STATUS.md) for the latest verification and blockers.

## Package layout

```
open-webui-workstation/
├── README.md
├── config/
│   ├── env.phase1.example          # Core OpenRouter + cache + defaults
│   ├── env.full.example            # All phases (secrets redacted)
│   ├── model-profiles.json         # Curated allowlist + roles
│   ├── system-prompt.txt           # Agent system prompt
│   └── admin-checklist.md          # UI steps after admin login
├── functions/
│   ├── council_maximum_intelligence.py
│   └── router_curated.py
├── computer/
│   └── docker-compose.yml          # Isolated Computer/Open Terminal service
├── scripts/
│   ├── verify_live.sh
│   └── apply_notes.md
└── docs/
    ├── ARCHITECTURE.md
    ├── STATUS.md
    └── BUILD_ORDER.md
```

## Four user-facing choices (end state)

| UI label | Model / pipe |
|----------|----------------|
| **Fast** | `openai/gpt-5.6-luna` (+ optional `:nitro` alias) |
| **Smart** | `openai/gpt-5.6-sol` (default) |
| **Max** | `openai/gpt-5.6-sol-pro` |
| **Council** | Pipe: Sol Pro + Opus 5 + Gemini 3.8 Flash (+ optional Grok) → Sol Pro synthesis |

Specialists remain selectable: Opus 5, Fable 5.1, Gemini 3.8 Flash, Grok 4.6.

## Hard requirements before Phase 1 can go live

1. Complete Open WebUI **admin onboarding** (or provide admin bootstrap credentials).
2. Provide **server-side** secrets (never browser-exposed):
   - `OPENROUTER_API_KEY` (required)
   - `OPENAI_API_KEY` (STT/TTS/embeddings/GPT Image 2)
   - `EXA_API_KEY` (primary search)
   - `TAVILY_API_KEY` (alternate search)
   - Optional: Microsoft Graph, GitHub, MiniMax TTS, etc.
3. Confirm model IDs are enabled on your OpenRouter account.

## Safety

- Do not modify other RunPod pods.
- Do not put `RUNPOD_API_KEY` inside Open WebUI.
- Disable public signup after the intended admin exists.
- Keep Computer/terminal execution on a **separate** service.
