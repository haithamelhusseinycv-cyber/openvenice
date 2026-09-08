"""
title: Shahy — Kimi K2.6 + DeepSeek Fallback
author: OpenAI / Shahy recovery
version: 1.0.0
description: Kimi K2.6 primary with exactly one DeepSeek V4 Flash fallback on transient provider failures.
"""

import os

import httpx


class Pipe:
    def __init__(self):
        self.api_base = "https://ai.nube.sh/api/v1"
        self.primary_model = "kimi-k2.6"
        self.fallback_model = "deepseek-v4-flash"
        self.transient_statuses = {408, 425, 429, 500, 502, 503, 504}

    @staticmethod
    def _payload(body: dict, model: str) -> dict:
        # Keep only OpenAI-compatible request fields that Nube may reasonably accept.
        allowed = {
            "messages",
            "temperature",
            "top_p",
            "max_tokens",
            "max_completion_tokens",
            "stop",
            "presence_penalty",
            "frequency_penalty",
            "response_format",
            "seed",
            "tools",
            "tool_choice",
            "parallel_tool_calls",
            "user",
            "n",
            "reasoning_effort",
        }
        payload = {k: v for k, v in body.items() if k in allowed}
        payload["model"] = model
        payload["stream"] = False
        return payload

    @staticmethod
    def _eligible_provider_400(response: httpx.Response) -> bool:
        if response.status_code != 400:
            return False
        text = response.text.lower()
        indicators = (
            "model unavailable",
            "model is unavailable",
            "temporarily unavailable",
            "model retired",
            "retired model",
            "model not found",
            "unsupported model",
        )
        return any(indicator in text for indicator in indicators)

    async def _request(self, model: str, body: dict, headers: dict) -> httpx.Response:
        url = f"{self.api_base}/chat/completions"
        payload = self._payload(body, model)
        async with httpx.AsyncClient(timeout=120.0) as client:
            return await client.post(url, headers=headers, json=payload)

    async def pipe(self, body: dict):
        api_key = os.getenv("NUBE_API_KEY", "").strip()
        if not api_key:
            return {
                "error": {
                    "message": "NUBE_API_KEY is not available in the Shahy runtime.",
                    "code": "NUBE_API_KEY_MISSING",
                }
            }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Attempt 1: Kimi K2.6.
        try:
            primary = await self._request(self.primary_model, body, headers)
        except (httpx.TimeoutException, httpx.RequestError):
            primary = None

        if primary is not None and primary.is_success:
            return primary.json()

        # Never fallback on auth / billing / permission errors.
        if primary is not None and primary.status_code in {401, 402, 403}:
            try:
                return primary.json()
            except Exception:
                return {
                    "error": {
                        "message": primary.text,
                        "code": str(primary.status_code),
                    }
                }

        eligible = primary is None
        if primary is not None:
            eligible = (
                primary.status_code in self.transient_statuses
                or self._eligible_provider_400(primary)
            )

        if not eligible:
            try:
                return primary.json()
            except Exception:
                return {
                    "error": {
                        "message": primary.text,
                        "code": str(primary.status_code),
                    }
                }

        # Attempt 2: exactly one DeepSeek fallback. No recursion / no fan-out.
        try:
            fallback = await self._request(self.fallback_model, body, headers)
        except httpx.TimeoutException:
            return {
                "error": {
                    "message": "Nube request timed out after the DeepSeek fallback.",
                    "code": "FALLBACK_TIMEOUT",
                }
            }
        except httpx.RequestError as exc:
            return {
                "error": {
                    "message": f"Nube network error after fallback: {exc}",
                    "code": "FALLBACK_NETWORK_ERROR",
                }
            }

        try:
            return fallback.json()
        except Exception:
            return {
                "error": {
                    "message": fallback.text,
                    "code": str(fallback.status_code),
                }
            }
