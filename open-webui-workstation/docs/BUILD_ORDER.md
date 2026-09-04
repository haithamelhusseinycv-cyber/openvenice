# Build order

Implement strictly in this sequence. Do not skip Phase 0.

## Phase 0 — Access & safety

- [ ] Admin onboarding complete on live URL  
- [ ] Public signup disabled  
- [ ] `WEBUI_SECRET_KEY` persistent  
- [ ] Confirm network volume mount `/app/backend/data`  
- [ ] No other RunPod workloads modified  

## Phase 1 — Core

- [ ] OpenRouter connection (server-side key, base URL, streaming, native tools)  
- [ ] Curated model allowlist only  
- [ ] Default model = Sol (`openai/gpt-5.6-sol`)  
- [ ] Task/background model = Luna (`openai/gpt-5.6-luna`)  
- [ ] `ENABLE_BASE_MODELS_CACHE=True`, `MODELS_CACHE_TTL=300`, `ENABLE_QUERIES_CACHE=True`  
- [ ] Smoke: model list + streaming chat  

## Phase 2 — Intelligence

- [ ] Enable Sol Pro, Opus 5, Fable 5.1, Gemini 3.8 Flash, Grok 4.6  
- [ ] Display names: Fast / Smart / Max / specialists  
- [ ] Luna `:nitro` alias if supported  
- [ ] System prompt applied  

## Phase 3 — Research

- [ ] Native function calling  
- [ ] Exa primary + Tavily alternate + DDG fallback  
- [ ] URL fetch / Playwright loader  
- [ ] Citations path tested  

## Phase 4 — Knowledge

- [ ] OpenAI embeddings `text-embedding-3-small`  
- [ ] Hybrid search + kb_exec + rerank baseline  
- [ ] Upload sample docs; retrieval quality check  

## Phase 5 — Execution

- [ ] Isolated Computer/Open Terminal service deployed  
- [ ] Wired as tool server to OWUI (not in-process)  
- [ ] Git/Python/Node/Playwright/office libs available  
- [ ] Security boundary verified  

## Phase 6 — Productivity

- [ ] Microsoft Graph MCP/OpenAPI (if credentials provided)  
- [ ] GitHub tools  
- [ ] DOCX/XLSX/PDF generation tools  

## Phase 7 — Media

- [ ] GPT Image 2 generation + editing  
- [ ] Optional Nano Banana 2 tool (explicit choice)  
- [ ] OpenAI STT `gpt-transcribe`  
- [ ] OpenAI TTS `tts-1` + chunked playback path  

## Phase 8 — Maximum intelligence

- [ ] Install `council_maximum_intelligence.py` pipe  
- [ ] Install `router_curated.py` pipe  
- [ ] Council manual-only; not default  
- [ ] Router policy documented and smoke-tested  

## Phase 9 — Mobile polish

- [ ] PWA install Android Chrome + iOS Safari  
- [ ] Safe-area, composer, 320–430px widths  
- [ ] Touch targets, tables, model picker  
- [ ] Voice mic permissions over HTTPS  

## Acceptance — four obvious choices

- [ ] Fast → Luna  
- [ ] Smart → Sol (default)  
- [ ] Max → Sol Pro  
- [ ] Council → multi-model synthesis pipe  
