import io
import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from voicetut_tts import GenerationParams, VoiceTutTTS

MODEL_ID = os.getenv("VOICETUT_MODEL", "mohammedaly22/VoiceTut-TTS")
DEFAULT_VOICE = os.getenv("VOICETUT_VOICE", "Omnia")
DEFAULT_STEPS = int(os.getenv("VOICETUT_STEPS", "32"))
DEFAULT_GUIDANCE = float(os.getenv("VOICETUT_GUIDANCE", "2.5"))
RUNPOD_HF_CACHE_ROOT = Path("/runpod-volume/huggingface-cache/hub")

app = FastAPI(title="OpenVenice VoiceTut TTS", version="1.1.0")
_model_load_error: str | None = None

origins = [
    origin.strip()
    for origin in os.getenv("VOICETUT_CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class SpeechRequest(BaseModel):
    model: str | None = None
    voice: str = DEFAULT_VOICE
    input: str = Field(min_length=1, max_length=12000)
    language: Literal["arz", "en"] = "arz"
    speed: float = Field(default=0.95, ge=0.5, le=2.0)
    response_format: Literal["wav"] = "wav"
    num_step: int = Field(default=DEFAULT_STEPS, ge=8, le=64)
    guidance_scale: float = Field(default=DEFAULT_GUIDANCE, ge=1.0, le=5.0)
    normalize: bool = True


def resolve_runpod_cached_model(model_id: str) -> str | None:
    """Use RunPod's cached Hugging Face snapshot when the endpoint provides one."""
    if "/" not in model_id or not RUNPOD_HF_CACHE_ROOT.is_dir():
        return None

    org, name = model_id.split("/", 1)
    model_root = RUNPOD_HF_CACHE_ROOT / f"models--{org}--{name}"
    snapshots_dir = model_root / "snapshots"
    refs_main = model_root / "refs" / "main"

    if refs_main.is_file():
        snapshot_hash = refs_main.read_text(encoding="utf-8").strip()
        candidate = snapshots_dir / snapshot_hash
        if candidate.is_dir():
            return str(candidate)

    if snapshots_dir.is_dir():
        snapshots = sorted(path for path in snapshots_dir.iterdir() if path.is_dir())
        if snapshots:
            return str(snapshots[0])

    return None


@lru_cache(maxsize=1)
def get_tts() -> VoiceTutTTS:
    model_source = resolve_runpod_cached_model(MODEL_ID) or MODEL_ID
    return VoiceTutTTS.from_pretrained(model_source)


def installed_voices() -> list[str]:
    return [speaker.speaker_name for speaker in get_tts().list_speakers()]


def warm_model() -> None:
    global _model_load_error
    try:
        get_tts()
        _model_load_error = None
    except Exception as exc:
        _model_load_error = str(exc)


@app.on_event("startup")
def start_model_warmup() -> None:
    threading.Thread(target=warm_model, name="voicetut-warmup", daemon=True).start()


@app.get("/ping")
def ping() -> Response:
    """RunPod Load Balancer health check: 204 while warming, 200 when ready."""
    if _model_load_error:
        return Response(content="model load failed", status_code=500)
    if get_tts.cache_info().currsize > 0:
        return Response(content="ok", status_code=200)
    return Response(status_code=204)


@app.get("/health")
def health():
    return {
        "ok": _model_load_error is None,
        "model": MODEL_ID,
        "default_voice": DEFAULT_VOICE,
        "loaded": get_tts.cache_info().currsize > 0,
        "error": _model_load_error,
    }


@app.get("/v1/voices")
def voices():
    return {"voices": installed_voices(), "default": DEFAULT_VOICE}


@app.post("/v1/audio/speech")
def speech(request: SpeechRequest):
    tts = get_tts()
    voices = installed_voices()
    if request.voice not in voices:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown VoiceTut speaker '{request.voice}'. Available: {', '.join(voices)}",
        )

    params = GenerationParams(
        num_step=request.num_step,
        guidance_scale=request.guidance_scale,
        speed=request.speed,
    )

    try:
        wav = tts.synthesize(
            request.input.strip(),
            speaker=request.voice,
            language=request.language,
            normalize=request.normalize,
            params=params,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"VoiceTut synthesis failed: {exc}") from exc

    buffer = io.BytesIO()
    sf.write(buffer, np.asarray(wav, dtype=np.float32), tts.sampling_rate, format="WAV")
    buffer.seek(0)

    headers = {
        "X-TTS-Provider": "VoiceTut-TTS",
        "X-TTS-Voice": request.voice,
        "X-TTS-Language": request.language,
    }
    return StreamingResponse(buffer, media_type="audio/wav", headers=headers)
