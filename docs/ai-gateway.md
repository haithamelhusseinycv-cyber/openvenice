# Open-model AI gateway (`/ai/v1`)

Same-origin, credential-isolating proxy from the browser to an OpenAI-compatible
inference backend. It reuses the pattern already proven by the VoiceTut proxy
(`nginx.voicetut.conf.template` + `scripts/openvenice-start.sh`), so it adds no
new service, no new deployment target and no new build stage.

## Why it exists

Before this change the browser called providers directly:

- the active Noor path (`playground-agent.ts`) called `https://api.venice.ai/api/v1`
  with a key the user pasted into the browser, and
- the Qwen/OpenAI-compatible client existed in source but was reachable only from
  the retired `chat-view` tab, so it was tree-shaken out of every shipped bundle.

The gateway inverts that: the browser talks to `/ai/v1` on its own origin, and
Nginx adds the upstream credential. No provider token can appear in the bundle,
in `localStorage`, or in an outbound request from the client.

## Routes

| Route | Method | Behaviour |
| --- | --- | --- |
| `/ai/v1/health` | GET | `200` when the gateway is configured, `503` when disabled |
| `/ai/v1/models` | GET | Proxied `GET /models`; doubles as the liveness probe |
| `/ai/v1/chat/completions` | POST | Proxied, streamed (response buffering off), 16 MB body cap |
| `/ai/v1/*` | any | `404` JSON — unknown gateway route |

`/ai/v1/health` never reveals the upstream host, and errors are normalized to
provider-neutral messages (`src/lib/ai-gateway.ts`).

## Runtime variables (Railway → service variables)

| Name | Purpose |
| --- | --- |
| `QWEN_UPSTREAM` | HTTPS OpenAI-compatible root, e.g. `https://host.example/v1` |
| `QWEN_API_KEY` | Upstream bearer token, injected by Nginx only |

Both are required to enable the gateway. If either is missing the container
starts normally, the gateway fails closed with `503`, and the UI resolves to the
configured external provider instead of showing a broken state.

Build-time `VITE_QWEN_BASE_URL` defaults to `/ai/v1`; leave it alone unless you
are deliberately pointing the client somewhere else. `VITE_QWEN_API_KEY` must
never exist.

## Failure semantics

- Gateway unconfigured → `503` → `provider-store` resolves `venice` (auto mode).
- Gateway unreachable / upstream `5xx` → probe reports `offline` → same fallback.
- Explicit user pin (`chatProviderMode: 'manual'`) is never overridden.
- `fallbackEnabled` defaults to `false`: no cross-provider fallback happens
  silently, because privacy and policy differ between providers.

## Local development

`vite.config.ts` proxies `/ai/v1/*` to `GATEWAY_PROXY_TARGET`
(default `http://127.0.0.1:8081`, rewriting `/ai/v1` → `/v1`). Run a local
`llama.cpp --server` or `vllm serve` on that port and the app behaves exactly as
it does in production.

## Deployment notes

- The model itself does **not** run on the Railway service. Railway hosts the
  static shell plus this proxy; the weights live on a GPU host (RunPod or your
  own hardware) behind `QWEN_UPSTREAM`.
- `/healthz` remains the container healthcheck. `/version.json` (generated at
  build time from `GIT_SHA`) reports build provenance for diagnostics.
- Rollback: revert the commit, or unset `QWEN_UPSTREAM`/`QWEN_API_KEY` to disable
  the gateway without a redeploy of code.
