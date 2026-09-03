# OpenVenice VoiceTut TTS

GPU-backed companion service for Noor's Egyptian-American voice. The default speaker is **Omnia** from `mohammedaly22/VoiceTut-TTS`.

## Required production configuration

The service fails closed unless `VOICETUT_API_KEYS` is configured. For the current personal OpenVenice deployment, set it to the same Venice API key entered by the authorized user. OpenVenice forwards that key only in the VoiceTut HTTPS request; it is not compiled into the web bundle or APK.

For key rotation, accept both keys temporarily:

```bash
VOICETUT_API_KEYS=old-key,new-key
VOICETUT_CORS_ORIGINS=https://openvenice-production.up.railway.app
```

Never put `VOICETUT_API_KEYS` or any private token in a `VITE_*` variable. Vite variables are public bundle configuration.

Local development may explicitly opt out:

```bash
VOICETUT_ALLOW_UNAUTHENTICATED=true
```

Do not enable that flag on an internet-accessible service.

## API and health

- `GET /live` — process liveness; no model or secret details.
- `GET /ready` or `GET /health` — authenticated configuration/model readiness.
- `GET /ping` — RunPod load-balancer probe: 204 while warming, 200 ready, 503 failed.
- `GET /v1/voices` — authenticated installed-speaker list.
- `GET /v1/metrics` — authenticated counters, active work and uptime.
- `POST /v1/audio/speech` — authenticated OpenAI-style speech endpoint returning WAV.

Send `Authorization: Bearer <key>` with every `/v1/*` request.

## Abuse and GPU controls

Defaults are conservative for a personal endpoint:

- 12 requests and 16,000 characters per credential per minute.
- 30 requests and 40,000 characters globally per worker per minute.
- One concurrent synthesis.
- 4,096 input characters and no more than 48 diffusion steps.
- Rejected quotas return `429` plus `Retry-After`; saturated GPU capacity returns `503`.

Configure with:

- `VOICETUT_REQUESTS_PER_MINUTE`
- `VOICETUT_CHARACTERS_PER_MINUTE`
- `VOICETUT_GLOBAL_REQUESTS_PER_MINUTE`
- `VOICETUT_GLOBAL_CHARACTERS_PER_MINUTE`
- `VOICETUT_MAX_CONCURRENT`
- `VOICETUT_MAX_INPUT_CHARS`

Quotas are intentionally in-memory and apply per RunPod worker. If the endpoint scales to multiple workers or multiple users, replace them with a shared Redis-backed limiter.

## Docker / GPU

```bash
docker build -t openvenice-voicetut .
docker run --gpus all -p 8000:80 \
  -e VOICETUT_API_KEYS='replace-me' \
  -e VOICETUT_CORS_ORIGINS='https://your-openvenice.example' \
  -v voicetut-hf-cache:/data/huggingface \
  openvenice-voicetut
```

The model is warmed during startup. Persist `/data/huggingface` to prevent repeated model downloads.

## Monitoring

Application logs are one-line JSON and include event, request ID, route, HTTP status and duration. Prometheus or the hosting platform can scrape/transform `/v1/metrics` using an authenticated request. Alert on:

- `/ready` remaining non-200 after the model warm-up allowance.
- increasing `synthesis_failed`, `auth_rejected` or `quota_rejected`;
- sustained `active_synthesis` at `VOICETUT_MAX_CONCURRENT`;
- container restart or GPU out-of-memory events.

Logs intentionally exclude bearer keys and submitted speech text.

## Other environment values

- `VOICETUT_MODEL` — default `mohammedaly22/VoiceTut-TTS`
- `VOICETUT_VOICE` — default `Omnia`
- `VOICETUT_STEPS` — default `32`
- `VOICETUT_GUIDANCE` — default `2.5`
- `VOICETUT_CORS_ORIGINS` — required comma-separated production origins
- `LOG_LEVEL` — default `INFO`

Configure the OpenVenice build with the public service URL only:

```bash
VITE_VOICETUT_BASE_URL=https://your-voicetut-service.example
```

If VoiceTut is unavailable, OpenVenice falls back to Venice Serena TTS.
