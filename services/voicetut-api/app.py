import io
import json
import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from security import (
    ApiKeyAuthenticator,
    AuthenticationError,
    ConfigurationError,
    FixedWindowQuota,
    Metrics,
)
from voicetut_tts import GenerationParams, VoiceTutTTS

MODEL_ID = os.getenv("VOICETUT_MODEL", "mohammedaly22/VoiceTut-TTS")
DEFAULT_VOICE = os.getenv("VOICETUT_VOICE", "Omnia")
DEFAULT_STEPS = int(os.getenv("VOICETUT_STEPS", "32"))
DEFAULT_GUIDANCE = float(os.getenv("VOICETUT_GUIDANCE", "2.5"))
MAX_INPUT_CHARS = int(os.getenv("VOICETUT_MAX_INPUT_CHARS", "4096"))
MAX_CONCURRENT = int(os.getenv("VOICETUT_MAX_CONCURRENT", "1"))
RUNPOD_HF_CACHE_ROOT = Path("/runpod-volume/huggingface-cache/hub")

logger = logging.getLogger("voicetut")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
authenticator = ApiKeyAuthenticator.from_environment()
quota = FixedWindowQuota(
    requests=int(os.getenv("VOICETUT_REQUESTS_PER_MINUTE", "12")),
    characters=int(os.getenv("VOICETUT_CHARACTERS_PER_MINUTE", "16000")),
)
global_quota = FixedWindowQuota(
    requests=int(os.getenv("VOICETUT_GLOBAL_REQUESTS_PER_MINUTE", "30")),
    characters=int(os.getenv("VOICETUT_GLOBAL_CHARACTERS_PER_MINUTE", "40000")),
)
generation_slots = threading.BoundedSemaphore(MAX_CONCURRENT)
metrics = Metrics()
_model_load_error: str | None = None


def log_event(event: str, **fields: object) -> None:
    logger.info(json.dumps({"event": event, "timestamp": time.time(), **fields}, separators=(",", ":"), default=str))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not authenticator.configured:
        log_event("configuration_error", detail="VOICETUT_API_KEYS is required")
    threading.Thread(target=warm_model, name="voicetut-warmup", daemon=True).start()
    yield


app = FastAPI(title="OpenVenice VoiceTut TTS", version="2.0.0", lifespan=lifespan)
origins = [value.strip() for value in os.getenv("VOICETUT_CORS_ORIGINS", "").split(",") if value.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    expose_headers=["Retry-After", "X-Request-ID", "X-TTS-Provider", "X-TTS-Voice", "X-TTS-Language"],
)


class SpeechRequest(BaseModel):
    model: str | None = None
    voice: str = DEFAULT_VOICE
    input: str = Field(min_length=1, max_length=MAX_INPUT_CHARS)
    language: Literal["arz", "en"] = "arz"
    speed: float = Field(default=0.95, ge=0.5, le=2.0)
    response_format: Literal["wav"] = "wav"
    num_step: int = Field(default=DEFAULT_STEPS, ge=8, le=48)
    guidance_scale: float = Field(default=DEFAULT_GUIDANCE, ge=1.0, le=5.0)
    normalize: bool = True


def authorize(request: Request) -> str:
    try:
        return authenticator.authenticate(
            request.headers.get("authorization"),
            request.headers.get("x-api-key"),
        )
    except ConfigurationError as exc:
        raise HTTPException(status_code=503, detail="Voice service authentication is not configured") from exc
    except AuthenticationError as exc:
        metrics.increment("auth_rejected")
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing VoiceTut API key",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def apply_quota(principal: str, characters: int) -> None:
    decisions = (
        quota.consume(principal, characters),
        global_quota.consume("global", characters),
    )
    denied = next((decision for decision in decisions if not decision.allowed), None)
    if denied:
        metrics.increment("quota_rejected")
        raise HTTPException(
            status_code=429,
            detail="VoiceTut quota exceeded",
            headers={"Retry-After": str(denied.retry_after)},
        )


def resolve_runpod_cached_model(model_id: str) -> str | None:
    if "/" not in model_id or not RUNPOD_HF_CACHE_ROOT.is_dir():
        return None
    org, name = model_id.split("/", 1)
    model_root = RUNPOD_HF_CACHE_ROOT / f"models--{org}--{name}"
    snapshots_dir = model_root / "snapshots"
    refs_main = model_root / "refs" / "main"
    if refs_main.is_file():
        candidate = snapshots_dir / refs_main.read_text(encoding="utf-8").strip()
        if candidate.is_dir():
            return str(candidate)
    if snapshots_dir.is_dir():
        snapshots = sorted(path for path in snapshots_dir.iterdir() if path.is_dir())
        if snapshots:
            return str(snapshots[0])
    return None


@lru_cache(maxsize=1)
def get_tts() -> VoiceTutTTS:
    return VoiceTutTTS.from_pretrained(resolve_runpod_cached_model(MODEL_ID) or MODEL_ID)


def installed_voices() -> list[str]:
    return [speaker.speaker_name for speaker in get_tts().list_speakers()]


def warm_model() -> None:
    global _model_load_error
    try:
        get_tts()
        _model_load_error = None
        log_event("model_ready", model=MODEL_ID)
    except Exception:
        _model_load_error = "model_load_failed"
        logger.exception(json.dumps({"event": "model_load_failed", "timestamp": time.time()}))


@app.middleware("http")
async def request_observability(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    started = time.monotonic()
    status = 500
    metrics.increment("requests_total")
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
    finally:
        log_event(
            "http_request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=status,
            duration_ms=round((time.monotonic() - started) * 1000, 2),
        )


@app.get("/ping")
def ping() -> Response:
    if _model_load_error:
        return Response(content="unavailable", status_code=503)
    return Response(content="ok" if get_tts.cache_info().currsize else "", status_code=200 if get_tts.cache_info().currsize else 204)


@app.get("/live")
def live():
    return {"ok": True}


@app.get("/ready")
@app.get("/health")
def ready(response: Response):
    ready_state = authenticator.configured and _model_load_error is None and get_tts.cache_info().currsize > 0
    response.status_code = 200 if ready_state else 503
    return {"ok": ready_state, "loaded": get_tts.cache_info().currsize > 0}


@app.get("/v1/metrics")
def service_metrics(request: Request):
    authorize(request)
    return metrics.snapshot()


@app.get("/v1/voices")
def voices(request: Request):
    authorize(request)
    return {"voices": installed_voices(), "default": DEFAULT_VOICE}


@app.post("/v1/audio/speech")
def speech(payload: SpeechRequest, request: Request):
    principal = authorize(request)
    text = payload.input.strip()
    apply_quota(principal, len(text))

    if not generation_slots.acquire(blocking=False):
        metrics.increment("concurrency_rejected")
        raise HTTPException(status_code=503, detail="VoiceTut is busy", headers={"Retry-After": "5"})

    metrics.active(1)
    metrics.increment("synthesis_total")
    metrics.increment("characters_total", len(text))
    try:
        tts = get_tts()
        voices = installed_voices()
        if payload.voice not in voices:
            raise HTTPException(status_code=400, detail="Unknown VoiceTut speaker")

        params = GenerationParams(
            num_step=payload.num_step,
            guidance_scale=payload.guidance_scale,
            speed=payload.speed,
        )
        wav = tts.synthesize(
            text,
            speaker=payload.voice,
            language=payload.language,
            normalize=payload.normalize,
            params=params,
        )
        buffer = io.BytesIO()
        sf.write(buffer, np.asarray(wav, dtype=np.float32), tts.sampling_rate, format="WAV")
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="audio/wav",
            headers={
                "X-TTS-Provider": "VoiceTut-TTS",
                "X-TTS-Voice": payload.voice,
                "X-TTS-Language": payload.language,
                "Cache-Control": "no-store",
            },
        )
    except HTTPException:
        metrics.increment("synthesis_failed")
        raise
    except Exception as exc:
        metrics.increment("synthesis_failed")
        logger.exception(json.dumps({"event": "synthesis_failed", "timestamp": time.time(), "principal": principal}))
        raise HTTPException(status_code=500, detail="VoiceTut synthesis failed") from exc
    finally:
        metrics.active(-1)
        generation_slots.release()
