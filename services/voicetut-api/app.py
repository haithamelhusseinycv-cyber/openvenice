import io
import os
from functools import lru_cache
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from voicetut_tts import GenerationParams, VoiceTutTTS

MODEL_ID = os.getenv("VOICETUT_MODEL", "mohammedaly22/VoiceTut-TTS")
DEFAULT_VOICE = os.getenv("VOICETUT_VOICE", "Omnia")
DEFAULT_STEPS = int(os.getenv("VOICETUT_STEPS", "32"))
DEFAULT_GUIDANCE = float(os.getenv("VOICETUT_GUIDANCE", "2.5"))

app = FastAPI(title="OpenVenice VoiceTut TTS", version="1.0.0")

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


@lru_cache(maxsize=1)
def get_tts() -> VoiceTutTTS:
    return VoiceTutTTS.from_pretrained(MODEL_ID)


def installed_voices() -> list[str]:
    return [speaker.speaker_name for speaker in get_tts().list_speakers()]


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_ID,
        "default_voice": DEFAULT_VOICE,
        "loaded": get_tts.cache_info().currsize > 0,
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
