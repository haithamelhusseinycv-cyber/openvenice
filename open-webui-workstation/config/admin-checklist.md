# Admin UI checklist (after login)

Live URL: https://c7togjwbwnqjqi-8080.proxy.runpod.net

## 0. First login

1. Create the single admin account (onboarding).
2. Admin → Users → disable public signup.
3. Confirm Settings persist after refresh (volume `/app/backend/data`).

## 1. OpenRouter connection

Admin → Settings → Connections (OpenAI):

- API Base URL: `https://openrouter.ai/api/v1`
- API Key: OpenRouter key (**server-side**)
- Enable streaming
- Native function calling / tools support ON
- Optional headers: `HTTP-Referer` = your proxy URL, `X-Title` = `Open-WebUI-Workstation`
- Disable Ollama if unused

## 2. Curate models

- Hide/disable everything except the allowlist in `model-profiles.json`
- Set default model: `openai/gpt-5.6-sol` (display **Smart**)
- Task / title / tags model: `openai/gpt-5.6-luna` (display **Fast**)
- Ensure Sol Pro, Opus 5, Fable 5.1, Gemini 3.8 Flash, Grok 4.6 visible as specialists
- Display names:
  - Fast → Luna
  - Smart → Sol
  - Max → Sol Pro

## 3. Global system policy + model overlays

1. Paste **entire** `config/system-prompt.txt` as the **global / default** system (agent) prompt.
   - This is the sole behavioral layer (sections 1–27): open/mature/direct, max latitude, hard age/consent bounds only, provider-aware routing, tools, research, voice, images, mobile, secrets, anti-overblocking.
2. Do **not** paste the full global policy again into every model.
3. For each curated model, paste **only** the short overlay from `config/model-prompts/`:

| Model | Overlay file |
|-------|----------------|
| Fast (Luna) | `model-prompts/luna-fast.txt` |
| Smart (Sol, default) | `model-prompts/sol-smart.txt` |
| Max (Sol Pro) | `model-prompts/sol-pro-max.txt` |
| Builder (Opus 5) | `model-prompts/opus-builder.txt` |
| Marathon (Fable 5.1) | `model-prompts/fable-marathon.txt` |
| Multimodal (Gemini) | `model-prompts/gemini-multimodal.txt` |
| Second Opinion (Grok) | `model-prompts/grok-verify.txt` |

4. Image settings: prefer contextual policy over blanket NSFW blocks; do not auto-sanitize permitted adult requests.
5. Voice/TTS: chunked sentence playback; do not sanitize spoken content relative to text.
6. Secrets: never put API keys in chat, client storage, or model prompts.

## 4. Functions / pipes

Admin → Workspace → Functions:

1. Import `functions/council_maximum_intelligence.py`
2. Import `functions/router_curated.py`
3. Enable both
4. Set valves API key if env injection is unavailable
5. Confirm **Council** is selectable but **not** default

## 5. Research

- Web Search ON
- Engine: Exa (primary), configure Tavily as alternate
- DuckDuckGo remains fallback
- Result count ~8–10
- Enable fetch_url / Playwright loader if present
- Agentic search ON; do not auto-search every chit-chat prompt

## 6. Knowledge / RAG

- Embedding engine OpenAI `text-embedding-3-small`
- Hybrid search ON, kb_exec ON
- Candidates 8 → rerank to 4–5

## 7. Voice / images

- STT: OpenAI `https://api.openai.com/v1`, model `gpt-transcribe`
- TTS: OpenAI `tts-1` (hd only when needed)
- Image gen+edit: `gpt-image-2` via direct OpenAI
- Secondary image tool (Nano Banana 2) only as explicit optional tool

## 8. Computer service

- Deploy `computer/docker-compose.yml` as a **separate** workload
- Connect via Open Terminal / MCP — not in-process code execution on the public app

## 9. Mobile

- Install PWA on Android Chrome + iOS Safari
- Verify composer, model picker, no horizontal page scroll at 320–430px
