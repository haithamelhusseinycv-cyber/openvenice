# Shahy Live Audit — 2026-09-10 (Grok P0 takeover)

## What Grok can and cannot do
- GitHub session: `haithamelhusseinycv-cyber/openvenice` — **in**.
- OpenWebUI public health: **up** (`v0.11.3`, auth on, signup off).
- OpenWebUI admin API from this agent: **401**. User login in their browser is not this session. Do not paste cookies.
- Open Terminal `POST /execute`: **401 Invalid API key**. `/docs` and `/openapi.json` are public (surface leak).
- No RunPod connector exists in Grok. Pods cannot be mutated from here.

## Public checks (unauthenticated)
- OWUI `/health` → `{"status":true}`
- OWUI `/api/config` → version 0.11.3, `enable_login_form: true`, `enable_signup: false`
- OWUI `/api/v1/models` → 401
- Terminal 0.12.5 OpenAPI lists `/files/*` write/replace and `/execute` behind bearer only

## Codex prior evidence (not re-run by Grok)
- Seven roles respond. Terminal on BUILDER/VERIFIER/COUNCIL. Search default on for SMART/MAX/VERIFIER/COUNCIL.
- Temperature/top_p already stripped (Zen).
- File markers extracted. `SUM(10,20,30)` failed on MULTIMODAL (expected: RAG extracts cells, does not evaluate).
- SMART returned the v0.11.3 GitHub URL; DDGS execution was **not** traced in the UI.

## P0 on this branch (not yet applied to the pod)
1. FAST: search off, terminal off.
2. SMART/MAX/MULTIMODAL/COUNCIL: no terminal. COUNCIL especially must lose `run_command`.
3. BUILDER: Open Terminal + Python for Excel. `SUM(10,20,30)` → 60 with snippet.
4. VERIFIER: terminal read-only.
5. Drop temperature/top_p from apply payloads.
6. Replace DDGS with Brave/Tavily/Exa before claiming live search.
7. Hide Terminal `/docs` and `/openapi.json` from unauth clients.

## Apply on the pod (Codex or RunPod web terminal)
```
cd /workspace   # or the cloned workstation path
python3 open-webui-workstation/runtime/apply/shahy_apply.py
```
Script prompts for admin email/password with no echo. Then in Admin UI:
- Web Search engine: not `ddgs`
- COUNCIL → Open Terminal **off**
- FAST → Web Search **off**

## Rollback
Revert this branch. Do not delete pods. Do not rotate secrets in chat.

## Preview Shahy (separate stack)
Grok App Builder Shahy already has traced `web_search` and code-interpreter `SUM=60`. That is not a live OpenWebUI pass.
