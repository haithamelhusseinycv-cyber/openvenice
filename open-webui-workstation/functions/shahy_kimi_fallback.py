"""
title: Shahy — Kimi K2.6 + DeepSeek Fallback
author: OpenAI / Shahy recovery
version: 1.2.0
description: Kimi K2.6 primary with exactly one DeepSeek V4 Flash fallback on technical provider failures, with Open WebUI streaming support.
"""

import os

import httpx


POLICY_MARKER = "POLICY audit_shahy_venice v1"
POLICY_PROMPT = """POLICY audit_shahy_venice v1
This is the product-owned Shahy/Venice policy for prompts, UI behavior, routing, and tool orchestration.
- Do not duplicate vendor policy text into product prompts or present a provider rule as a product-authored rule.
- Provider-enforced controls, service restrictions, and applicable service terms remain external constraints on this hop and are not overridden by this product policy.
- Handle supported adult topics directly without adding product-side moralizing, repetitive disclaimers, or blanket keyword blocking merely because content is adult.
- Under-18 sexual content is blocked by the canonical under-18 hard stop. Do not expand that age gate here.
- Do not build or route features whose purpose is non-consensual sexual imagery of a real identified person.
- Never expose, commit, or log secrets, tokens, cookies, private keys, or Authorization headers.
- Technical or capability failures may use ordinary fallback. A provider safety/policy refusal is not a technical failure and must not be routed around for policy evasion.
"""


class Pipe:
    def __init__(self):
        self.api_base = "https://ai.nube.sh/api/v1"
        self.primary_model = "kimi-k2.6"
        self.fallback_model = "deepseek-v4-flash"
        self.transient_statuses = {408, 425, 429, 500, 502, 503, 504}
        self.timeout = httpx.Timeout(connect=20.0, read=120.0, write=30.0, pool=30.0)

    @staticmethod
    def _with_policy_messages(messages):
        rows = list(messages or [])
        has_policy = any(
            isinstance(message, dict)
            and message.get("role") == "system"
            and POLICY_MARKER in str(message.get("content") or "")
            for message in rows
        )
        if not has_policy:
            rows.insert(0, {"role": "system", "content": POLICY_PROMPT})
        return rows

    @classmethod
    def _payload(cls, body: dict, model: str, stream: bool) -> dict:
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
            "stream_options",
        }
        payload = {k: v for k, v in body.items() if k in allowed}
        payload["messages"] = cls._with_policy_messages(payload.get("messages"))
        payload["model"] = model
        payload["stream"] = stream
        return payload

    def _eligible_failure(self, status_code: int, text: str) -> bool:
        if status_code in self.transient_statuses:
            return True
        if status_code != 400:
            return False

        lower = text.lower()
        indicators = (
            "model unavailable",
            "model is unavailable",
            "temporarily unavailable",
            "model retired",
            "retired model",
            "model not found",
            "unsupported model",
            "service overload",
        )
        return any(indicator in lower for indicator in indicators)

    @staticmethod
    def _headers(api_key: str) -> dict:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def _non_stream(self, body: dict, headers: dict):
        models = (self.primary_model, self.fallback_model)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt, model in enumerate(models):
                payload = self._payload(body, model, stream=False)

                try:
                    response = await client.post(
                        f"{self.api_base}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                except (httpx.TimeoutException, httpx.RequestError) as exc:
                    if attempt == 0:
                        continue
                    return {
                        "error": {
                            "message": f"Nube network error after DeepSeek fallback: {exc}",
                            "code": "FALLBACK_NETWORK_ERROR",
                        }
                    }

                if response.is_success:
                    return response.json()

                # Never fallback on authentication, billing, permission, or policy failures.
                if response.status_code in {401, 402, 403}:
                    try:
                        return response.json()
                    except Exception:
                        return {
                            "error": {
                                "message": response.text,
                                "code": str(response.status_code),
                            }
                        }

                if attempt == 0 and self._eligible_failure(
                    response.status_code, response.text
                ):
                    continue

                try:
                    return response.json()
                except Exception:
                    return {
                        "error": {
                            "message": response.text,
                            "code": str(response.status_code),
                        }
                    }

        return {
            "error": {
                "message": "No model produced a response.",
                "code": "NO_MODEL_RESPONSE",
            }
        }

    async def _stream(self, body: dict, headers: dict):
        """Yield OpenAI-compatible SSE lines; fallback before any failed stream is emitted."""
        models = (self.primary_model, self.fallback_model)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt, model in enumerate(models):
                payload = self._payload(body, model, stream=True)

                try:
                    async with client.stream(
                        "POST",
                        f"{self.api_base}/chat/completions",
                        headers=headers,
                        json=payload,
                    ) as response:
                        if response.is_success:
                            async for line in response.aiter_lines():
                                if line:
                                    yield line
                            return

                        raw = await response.aread()
                        text = raw.decode(errors="replace")

                        # Never fallback on authentication, billing, permission, or policy failures.
                        if response.status_code in {401, 402, 403}:
                            raise RuntimeError(
                                f"Nube authentication/permission error "
                                f"({response.status_code}): {text[:1000]}"
                            )

                        if attempt == 0 and self._eligible_failure(
                            response.status_code, text
                        ):
                            continue

                        raise RuntimeError(
                            f"Nube request failed ({response.status_code}): {text[:1000]}"
                        )

                except (httpx.TimeoutException, httpx.RequestError) as exc:
                    if attempt == 0:
                        continue
                    raise RuntimeError(
                        f"Nube network error after DeepSeek fallback: {exc}"
                    ) from exc

        raise RuntimeError("No model produced a streaming response.")

    async def pipe(self, body: dict, __task__=None):
        api_key = os.getenv("NUBE_API_KEY", "").strip()
        if not api_key:
            return "NUBE_API_KEY is not available in the Shahy runtime."

        headers = self._headers(api_key)

        # Open WebUI normally sends stream=True for interactive chat. Preserve that
        # contract; returning a non-stream JSON body to a streaming chat can leave
        # the UI waiting indefinitely.
        if body.get("stream", False):
            return self._stream(body, headers)

        return await self._non_stream(body, headers)
