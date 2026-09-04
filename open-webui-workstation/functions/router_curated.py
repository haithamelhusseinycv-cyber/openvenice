"""
title: Router — Curated
author: workstation
version: 1.0.0
description: Lightweight explicit routing across curated OpenRouter models. Not an opaque sole default.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Awaitable, Callable, List, Optional

import aiohttp
from pydantic import BaseModel, Field


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value.strip()
    return default


class Pipe:
    class Valves(BaseModel):
        OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")
        OPENROUTER_API_KEY: str = Field(default="")
        HTTP_REFERER: str = Field(default="")
        X_TITLE: str = Field(default="Open-WebUI-Router")

        MODEL_FAST: str = Field(default="openai/gpt-5.6-luna")
        MODEL_FAST_NITRO: str = Field(default="openai/gpt-5.6-luna:nitro")
        MODEL_SMART: str = Field(default="openai/gpt-5.6-sol")
        MODEL_MAX: str = Field(default="openai/gpt-5.6-sol-pro")
        MODEL_BUILDER: str = Field(default="anthropic/claude-opus-5")
        MODEL_MARATHON: str = Field(default="anthropic/claude-fable-5.1")
        MODEL_MULTIMODAL: str = Field(default="google/gemini-3.8-flash")
        MODEL_SECOND_OPINION: str = Field(default="x-ai/grok-4.6")
        # Council is a separate pipe id in OWUI; router only labels the choice.
        MODEL_COUNCIL_HINT: str = Field(default="council_maximum_intelligence.maximum_intelligence")

        USE_NITRO_FOR_FAST: bool = Field(default=True)
        REQUEST_TIMEOUT_SECONDS: int = Field(default=180)
        MAX_OUTPUT_TOKENS: int = Field(default=32768)
        TEMPERATURE: float = Field(default=0.2)

    def __init__(self) -> None:
        self.type = "manifold"
        self.id = "router_curated"
        self.name = "Router: "
        self.valves = self.Valves(
            OPENROUTER_API_KEY=_env("OPENROUTER_API_KEY", "OPENAI_API_KEY"),
        )

    def pipes(self) -> List[dict]:
        return [
            {"id": "auto", "name": "Curated Auto"},
            {"id": "fast", "name": "Force Fast (Luna)"},
            {"id": "smart", "name": "Force Smart (Sol)"},
            {"id": "max", "name": "Force Max (Sol Pro)"},
            {"id": "builder", "name": "Force Builder (Opus 5)"},
            {"id": "marathon", "name": "Force Marathon (Fable 5.1)"},
            {"id": "multimodal", "name": "Force Multimodal (Gemini)"},
            {"id": "second_opinion", "name": "Force Second Opinion (Grok)"},
        ]

    def _api_key(self) -> str:
        return (self.valves.OPENROUTER_API_KEY or _env("OPENROUTER_API_KEY", "OPENAI_API_KEY")).strip()

    def _headers(self) -> dict:
        key = self._api_key()
        if not key:
            raise RuntimeError("Router pipe: missing OpenRouter API key.")
        headers = {
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        }
        if self.valves.HTTP_REFERER:
            headers["HTTP-Referer"] = self.valves.HTTP_REFERER
        if self.valves.X_TITLE:
            headers["X-Title"] = self.valves.X_TITLE
        return headers

    def _combined_text(self, body: dict) -> str:
        parts: List[str] = []
        for message in body.get("messages") or []:
            content = message.get("content")
            if isinstance(content, str):
                parts.append(content)
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            parts.append(str(item.get("text") or ""))
                        elif item.get("type") in {"image_url", "input_audio", "video_url", "file"}:
                            parts.append(f"[attachment:{item.get('type')}]")
                    elif isinstance(item, str):
                        parts.append(item)
        return "\n".join(parts)

    def _has_multimodal_parts(self, body: dict) -> bool:
        for message in body.get("messages") or []:
            content = message.get("content")
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") in {
                        "image_url",
                        "input_audio",
                        "video_url",
                        "file",
                    }:
                        return True
        text = self._combined_text(body).lower()
        return any(
            k in text
            for k in [
                "screenshot",
                "attached image",
                "see this image",
                "video",
                "audio file",
                "transcribe",
                ".mp4",
                ".wav",
                ".mp3",
                ".png",
                ".jpg",
                "pdf page",
            ]
        )

    def _route_key(self, pipe_id: str, body: dict) -> str:
        forced = (pipe_id or "").split(".")[-1]
        if forced in {"fast", "smart", "max", "builder", "marathon", "multimodal", "second_opinion"}:
            return forced

        text = self._combined_text(body).lower()

        if self._has_multimodal_parts(body):
            return "multimodal"

        if re.search(r"\b(council|multi[- ]model|second opinions?|debate)\b", text):
            # Router cannot invoke another pipe cleanly in all builds; use Max + note.
            return "max"

        if re.search(
            r"\b(second opinion|verify independently|challenge this|steelman|red team)\b",
            text,
        ):
            return "second_opinion"

        if re.search(
            r"\b(marathon|multi[- ]day|large refactor|entire codebase|autonomous project|hundreds of files)\b",
            text,
        ):
            return "marathon"

        if re.search(
            r"\b(react|typescript|python|debug|repository|pull request|ui\/ux|excel|docx|powerpoint|playwright|terminal|git clone|unit test)\b",
            text,
        ):
            return "builder"

        if re.search(
            r"\b(absolute max|sol pro|deep reasoning|mission critical|architecture decision|legal analysis|financial model)\b",
            text,
        ):
            return "max"

        if len(text) < 120 and re.search(
            r"\b(hi|hello|thanks|title|tag|summarize|short|quick|eli5)\b",
            text,
        ):
            return "fast"

        return "smart"

    def _model_for_route(self, route: str) -> str:
        mapping = {
            "fast": self.valves.MODEL_FAST_NITRO if self.valves.USE_NITRO_FOR_FAST else self.valves.MODEL_FAST,
            "smart": self.valves.MODEL_SMART,
            "max": self.valves.MODEL_MAX,
            "builder": self.valves.MODEL_BUILDER,
            "marathon": self.valves.MODEL_MARATHON,
            "multimodal": self.valves.MODEL_MULTIMODAL,
            "second_opinion": self.valves.MODEL_SECOND_OPINION,
        }
        return mapping.get(route, self.valves.MODEL_SMART)

    async def pipe(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__: Optional[Callable[[dict], Awaitable[None]]] = None,
    ) -> Any:
        # body["model"] often looks like "router_curated.auto"
        model_field = str(body.get("model") or "")
        route = self._route_key(model_field, body)
        target = self._model_for_route(route)

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": f"Router → {route} → {target}",
                        "done": False,
                    },
                }
            )

        payload = dict(body)
        payload["model"] = target
        payload["stream"] = False
        # Bound runaway completions; callers can still ask for heavy work via Max/Marathon.
        payload.setdefault("max_tokens", self.valves.MAX_OUTPUT_TOKENS)
        if "temperature" not in payload:
            payload["temperature"] = self.valves.TEMPERATURE

        url = self.valves.OPENROUTER_BASE_URL.rstrip("/") + "/chat/completions"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers=self._headers(),
                json=payload,
                timeout=aiohttp.ClientTimeout(total=self.valves.REQUEST_TIMEOUT_SECONDS),
            ) as resp:
                raw = await resp.text()
                if resp.status >= 400:
                    return f"Router error HTTP {resp.status} for model {target}: {raw[:2000]}"
                data = json.loads(raw)

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {"description": f"Routed via {route}", "done": True},
                }
            )

        choices = data.get("choices") or []
        if not choices:
            return f"Router: empty response from {target}"
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            return "\n".join(
                str(p.get("text") if isinstance(p, dict) else p) for p in content
            )
        prefix = f"<!-- router_route={route}; model={target} -->\n"
        return prefix + str(content or "")
