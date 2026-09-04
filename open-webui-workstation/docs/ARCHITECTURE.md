# Target Architecture — Maximum Practical Open WebUI

## Objective

Private, mobile-first AI **workstation** (not a basic chatbot).

Priority order:

1. Maximum reasoning quality when required  
2. Excellent autonomous tool use  
3. Strong coding and application development  
4. Professional Word/Excel/PDF work  
5. High-quality web research with source verification  
6. Image understanding, generation, and editing  
7. Reliable low-latency voice  
8. Android/iOS PWA usability  
9. High reliability with graceful fallback  
10. Cost efficiency without blocking frontier models  

Local inference is **not** required. Main Open WebUI stays **CPU-only**; intelligence is cloud APIs.

## LLM provider

- Gateway: **OpenRouter**
- API type: OpenAI Compatible  
- Base URL: `https://openrouter.ai/api/v1`  
- Streaming: ON  
- Native tool/function calling: ON  
- Credentials: **server-side only**

### Curated allowlist (do not expose full catalog)

| ID | Profile |
|----|---------|
| `openai/gpt-5.6-sol` | **Smart / DAILY MAX** (default) |
| `openai/gpt-5.6-sol-pro` | **Max / ABSOLUTE MAX** |
| `openai/gpt-5.6-luna` | **Fast** + task/background |
| `openai/gpt-5.6-luna:nitro` | Fast latency alias |
| `anthropic/claude-opus-5` | Builder / professional |
| `anthropic/claude-fable-5.1` | Autonomous marathon |
| `google/gemini-3.8-flash` | Multimodal specialist |
| `x-ai/grok-4.6` | Second opinion / STEM |

## Profiles (summary)

- **DAILY MAX (Sol):** default for reasoning, finance, analysis, AR/EN, writing, coding, docs, agents. High reasoning when available.  
- **ABSOLUTE MAX (Sol Pro):** hard analysis, architecture, legal/business, multi-stage research. Not default (latency).  
- **BUILDER (Opus 5):** apps, large codebases, UI/UX, office deliverables, tool workflows.  
- **MARATHON (Fable 5.1):** long autonomous multi-tool projects.  
- **FAST (Luna):** titles, tags, routing, summaries, lightweight tools; `:nitro` when speed matters.  
- **MULTIMODAL (Gemini 3.8 Flash):** screenshots, PDFs, audio/video, mixed media.  
- **SECOND OPINION (Grok 4.6):** verification, STEM, independent challenge.

## Council mode

Custom pipe **Council — Maximum Intelligence** (manual select only):

1. Parallel: Sol Pro, Opus 5, Gemini 3.8 Flash  
2. Optional 4th: Grok 4.6 for STEM/technical  
3. Synthesis: Sol Pro — disagreements, evidence over majority, minority views retained, uncertainty flagged  

## Router mode

Custom pipe **Router — Curated** (explicit policy, not opaque sole default):

| Signal | Route |
|--------|--------|
| trivial/fast | Luna |
| normal / difficult | Sol |
| maximum reasoning | Sol Pro |
| software/computer | Opus 5 |
| long autonomous | Fable 5.1 |
| video/audio/multimodal | Gemini |
| verification | Grok |
| mission-critical multi-perspective | Council |

OpenRouter provider routing: quality-aware by default; `:nitro` only for speed-critical paths; never force cheapest on important tool workflows.

## Parameters

- Prefer provider defaults; no aggressive global temperature.  
- Streaming ON.  
- Normal max output 16K–32K; heavy docs/code 64K; avoid 128K unless necessary.  
- Context: ~128K ordinary, ~256K substantial, expand only when required; do not dump 1M every turn.

## Performance flags

```
ENABLE_BASE_MODELS_CACHE=True
MODELS_CACHE_TTL=300
ENABLE_QUERIES_CACHE=True
```

Luna = task/background model where UI allows. Picker = curated models only.

## Tools

Function calling: **Native** (not Legacy).

Enable (permissioned): Web Search, URL fetch, Knowledge, Files, Memory, Notes, Code Interpreter, Image Generation, Open Terminal, MCP/OpenAPI, subagents.

Agent decides when tools are needed — do not auto-dump web results into every prompt.

## Research

- Primary: **Exa**  
- Alternate: **Tavily**  
- Fallback: DuckDuckGo  
- Agentic web search ON; ~8–10 results; Playwright for JS pages  
- Pattern: search → inspect → follow → cross-check → cite  
- Serious research: ≥2 independent credible sources when practical  

## Computer / execution

**Separate isolated CPU service** (not inside main OWUI container):

terminal, filesystem, Git, Python, Node, npm, Playwright/Chromium, ffmpeg, Pandoc, pandas, openpyxl, python-docx, matplotlib, build tools.

Target ~4 vCPU / 8 GB; scale only if measured need.

## Productivity MCP/OpenAPI

Microsoft Graph (mail/calendar/contacts/OneDrive/SharePoint), GitHub, document creation (DOCX/XLSX/PDF/PPTX). Credentials outside model context.

## RAG

- Embeddings: OpenAI `text-embedding-3-small` (not local CPU)  
- `ENABLE_RAG_HYBRID_SEARCH=True`, `ENABLE_KB_EXEC=True`  
- Semantic + BM25, then rerank  
- Start: 8 candidates → 4–5 chunks; threshold low then calibrate  
- Full Context for short critical docs; focused RAG for libraries  
- Reindex after embedding model change  

## Voice

- STT: OpenAI direct `https://api.openai.com/v1`, model `gpt-transcribe`  
- TTS: OpenAI `tts-1` default; `tts-1-hd` when quality > latency  
- Chunked sentence TTS playback (start after first sentence; queue; cancel on stop)  
- Target perceived start: a few seconds, not ~30s  

## Images

- Primary: OpenAI **GPT Image 2** (`gpt-image-2`) gen + edit  
- Secondary tool: Nano Banana 2 / Gemini Flash Image (explicit user choice, no silent switch)  
- No RunPod GPU for images  

## Mobile / PWA

Installable PWA; viewport-fit=cover; safe-area; no page-wide horizontal scroll; 44–48px targets; sticky composer; test 320–430px widths. Prefer CSS/config over large OWUI forks.

## Infrastructure

Main OWUI: CPU, prefer 4 vCPU / 8 GB, volume `/app/backend/data`, port 8080, stable `WEBUI_SECRET_KEY`. Keep healthy existing pod when possible.

## Security

HTTPS; server-side keys; no RunPod key in OWUI; signup off after admin; admin-only tool admin; sandbox execution; rate limits; volume/DB backups; health monitoring; no secret logging; provider spend alerts.

## System prompt

See `config/system-prompt.txt`.
