"""
title: Council — Maximum Intelligence
author: workstation
version: 1.0.0
description: Parallel multi-model council with Sol Pro synthesis. Manual select only — never the daily default.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, AsyncGenerator, Awaitable, Callable, List, Optional

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
        OPENROUTER_BASE_URL: str = Field(
            default="https://openrouter.ai/api/v1",
            description="OpenAI-compatible OpenRouter base URL",
        )
        OPENROUTER_API_KEY: str = Field(
            default="",
            description="Server-side OpenRouter key (leave empty to use OPENAI_API_KEY / OPENROUTER_API_KEY env)",
        )
        HTTP_REFERER: str = Field(default="", description="Optional OpenRouter HTTP-Referer")
        X_TITLE: str = Field(default="Open-WebUI-Council", description="Optional OpenRouter X-Title")
        PANEL_MODELS: List[str] = Field(
            default=[
                "openai/gpt-5.6-sol-pro",
                "anthropic/claude-opus-5",
                "google/gemini-3.8-flash",
            ],
            description="Models queried in parallel",
        )
        OPTIONAL_STEM_MODEL: str = Field(
            default="x-ai/grok-4.6",
            description="Added when the query looks technical/STEM or force_include_stem is true",
        )
        FORCE_INCLUDE_STEM: bool = Field(
            default=False,
            description="Always include the optional STEM/second-opinion model",
        )
        SYNTHESIZER_MODEL: str = Field(
            default="openai/gpt-5.6-sol-pro",
            description="Final synthesis model",
        )
        REQUEST_TIMEOUT_SECONDS: int = Field(default=180)
        MAX_PANEL_OUTPUT_TOKENS: int = Field(default=8192)
        MAX_SYNTHESIS_OUTPUT_TOKENS: int = Field(default=16384)
        TEMPERATURE: float = Field(default=0.2)

    def __init__(self) -> None:
        self.type = "manifold"
        self.id = "council_maximum_intelligence"
        self.name = "Council: "
        self.valves = self.Valves(
            OPENROUTER_API_KEY=_env("OPENROUTER_API_KEY", "OPENAI_API_KEY"),
        )

    def pipes(self) -> List[dict]:
        return [
            {
                "id": "maximum_intelligence",
                "name": "Maximum Intelligence",
            }
        ]

    def _api_key(self) -> str:
        return (self.valves.OPENROUTER_API_KEY or _env("OPENROUTER_API_KEY", "OPENAI_API_KEY")).strip()

    def _headers(self) -> dict:
        key = self._api_key()
        if not key:
            raise RuntimeError(
                "Council pipe: missing OpenRouter API key. Set valve OPENROUTER_API_KEY or env OPENAI_API_KEY."
            )
        headers = {
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        }
        if self.valves.HTTP_REFERER:
            headers["HTTP-Referer"] = self.valves.HTTP_REFERER
        if self.valves.X_TITLE:
            headers["X-Title"] = self.valves.X_TITLE
        return headers

    def _user_text(self, body: dict) -> str:
        messages = body.get("messages") or []
        chunks: List[str] = []
        for message in messages:
            role = message.get("role")
            if role not in {"user", "system"}:
                continue
            content = message.get("content")
            if isinstance(content, str):
                chunks.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        chunks.append(str(part.get("text") or ""))
                    elif isinstance(part, str):
                        chunks.append(part)
        return "\n\n".join(c for c in chunks if c).strip()

    def _should_include_stem(self, text: str) -> bool:
        if self.valves.FORCE_INCLUDE_STEM:
            return True
        if not text:
            return False
        patterns = [
            r"\bstem\b",
            r"\bmath\b",
            r"\bphysic",
            r"\bchemistr",
            r"\bengineer",
            r"\balgorithm",
            r"\bproof\b",
            r"\btheorem\b",
            r"\bdebug",
            r"\bcode\b",
            r"\bcompil",
            r"\bbenchmark",
            r"\bsecond opinion\b",
            r"\bverify\b",
            r"\bindependent\b",
            r"\breproduc",
        ]
        lowered = text.lower()
        return any(re.search(p, lowered) for p in patterns)

    def _panel_models(self, text: str) -> List[str]:
        models = list(self.valves.PANEL_MODELS)
        if self._should_include_stem(text) and self.valves.OPTIONAL_STEM_MODEL:
            if self.valves.OPTIONAL_STEM_MODEL not in models:
                models.append(self.valves.OPTIONAL_STEM_MODEL)
        # de-dupe preserve order
        seen = set()
        ordered = []
        for model in models:
            if model and model not in seen:
                seen.add(model)
                ordered.append(model)
        return ordered

    async def _chat_completion(
        self,
        session: aiohttp.ClientSession,
        model: str,
        messages: list,
        max_tokens: int,
    ) -> str:
        url = self.valves.OPENROUTER_BASE_URL.rstrip("/") + "/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "temperature": self.valves.TEMPERATURE,
            "max_tokens": max_tokens,
        }
        async with session.post(
            url,
            headers=self._headers(),
            json=payload,
            timeout=aiohttp.ClientTimeout(total=self.valves.REQUEST_TIMEOUT_SECONDS),
        ) as resp:
            raw = await resp.text()
            if resp.status >= 400:
                return f"[ERROR from {model} HTTP {resp.status}] {raw[:2000]}"
            data = json.loads(raw)
            choices = data.get("choices") or []
            if not choices:
                return f"[ERROR from {model}] empty choices"
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        parts.append(str(part["text"]))
                    else:
                        parts.append(str(part))
                return "\n".join(parts).strip()
            return str(content or "").strip()

    def _synthesis_messages(self, user_text: str, panel: List[tuple[str, str]]) -> list:
        dossier_parts = []
        for model, answer in panel:
            dossier_parts.append(f"### Panel member: {model}\n{answer}\n")
        dossier = "\n".join(dossier_parts)
        system = (
            "You are the Council synthesizer. You receive independent answers from multiple frontier models. "
            "Produce ONE final answer for the user.\n\n"
            "Requirements:\n"
            "- Identify disagreements explicitly.\n"
            "- Check factual conflicts; prefer evidence over majority voting.\n"
            "- Retain useful minority viewpoints when they add real value.\n"
            "- Give a single coherent final recommendation/answer.\n"
            "- Explicitly flag unresolved uncertainty.\n"
            "- Do not invent tool use or sources that were not provided.\n"
            "- Be concise by default; go deep when the question demands it.\n"
        )
        user = (
            f"## Original user task\n{user_text}\n\n"
            f"## Panel answers\n{dossier}\n\n"
            "## Your job\nWrite the final Council answer now."
        )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    async def pipe(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__: Optional[Callable[[dict], Awaitable[None]]] = None,
    ) -> Any:
        user_text = self._user_text(body)
        if not user_text:
            return "Council: no user text found in request."

        panel_models = self._panel_models(user_text)

        async def emit(status: str, done: bool = False) -> None:
            if not __event_emitter__:
                return
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {"description": status, "done": done},
                }
            )

        await emit(f"Council panel: {', '.join(panel_models)}")

        panel_messages = [
            {
                "role": "system",
                "content": (
                    "You are one member of an expert council. Answer the user's task carefully and directly. "
                    "State assumptions and uncertainty. Do not defer to other models."
                ),
            },
            {"role": "user", "content": user_text},
        ]

        async with aiohttp.ClientSession() as session:
            tasks = [
                self._chat_completion(
                    session,
                    model,
                    panel_messages,
                    self.valves.MAX_PANEL_OUTPUT_TOKENS,
                )
                for model in panel_models
            ]
            answers = await asyncio.gather(*tasks)
            panel = list(zip(panel_models, answers))

            for model, answer in panel:
                preview = (answer or "").replace("\n", " ")[:160]
                await emit(f"Received {model}: {preview}...")

            await emit(f"Synthesizing with {self.valves.SYNTHESIZER_MODEL}")
            final = await self._chat_completion(
                session,
                self.valves.SYNTHESIZER_MODEL,
                self._synthesis_messages(user_text, panel),
                self.valves.MAX_SYNTHESIS_OUTPUT_TOKENS,
            )

        await emit("Council complete", done=True)

        # Optional transparency appendix (kept short)
        appendix_lines = ["", "---", "### Council panel (raw)", ""]
        for model, answer in panel:
            appendix_lines.append(f"<details><summary>{model}</summary>\n\n{answer}\n\n</details>")
        appendix = "\n".join(appendix_lines)

        return f"{final}\n{appendix}"
