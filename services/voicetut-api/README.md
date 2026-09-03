# OpenVenice VoiceTut TTS

GPU-backed companion service for Noor's Egyptian-American voice. The default speaker is **Omnia** from `mohammedaly22/VoiceTut-TTS`.

## API

- `GET /health` — service/model status
- `GET /v1/voices` — installed built-in speakers
- `POST /v1/audio/speech` — OpenAI-style speech endpoint returning WAV audio

Example request:

```json
{
  "model": "mohammedaly22/VoiceTut-TTS",
  "voice": "Omnia",
  "input": "عندي meeting بكرة الصبح",
  "language": "arz",
  "speed": 0.95,
  "response_format": "wav"
}
```

## Docker / GPU

Build from this directory:

```bash
docker build -t openvenice-voicetut .
docker run --gpus all -p 8000:8000 \
  -v voicetut-hf-cache:/data/huggingface \
  openvenice-voicetut
```

The first synthesis request downloads/loads the VoiceTut checkpoint. Persist `/data/huggingface` to avoid downloading the model after every restart.

## Environment

- `VOICETUT_MODEL` — defaults to `mohammedaly22/VoiceTut-TTS`
- `VOICETUT_VOICE` — defaults to `Omnia`
- `VOICETUT_STEPS` — defaults to `32`
- `VOICETUT_GUIDANCE` — defaults to `2.5`
- `VOICETUT_CORS_ORIGINS` — comma-separated origins, default `*`

For the OpenVenice web/Android build, set:

```bash
VITE_VOICETUT_BASE_URL=https://your-voicetut-service.example
```

The app uses VoiceTut/Omnia when this URL is configured. If the service is unavailable or not configured, Noor falls back to the existing Venice Serena TTS so spoken replies still work.
