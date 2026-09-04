"""Dependency-free security, quota and metrics primitives for VoiceTut."""
from __future__ import annotations

import hashlib
import hmac
import os
import threading
import time
from dataclasses import dataclass


def _csv(name: str) -> tuple[str, ...]:
    return tuple(value.strip() for value in os.getenv(name, "").split(",") if value.strip())


class AuthenticationError(Exception):
    pass


class ConfigurationError(Exception):
    pass


class ApiKeyAuthenticator:
    def __init__(self, keys: tuple[str, ...], allow_unauthenticated: bool = False):
        self._keys = keys
        self._allow_unauthenticated = allow_unauthenticated

    @classmethod
    def from_environment(cls) -> "ApiKeyAuthenticator":
        return cls(
            _csv("VOICETUT_API_KEYS"),
            os.getenv("VOICETUT_ALLOW_UNAUTHENTICATED", "").lower() == "true",
        )

    @property
    def configured(self) -> bool:
        return bool(self._keys) or self._allow_unauthenticated

    def authenticate(self, authorization: str | None, api_key: str | None = None) -> str:
        if self._allow_unauthenticated and not self._keys:
            return "development"
        if not self._keys:
            raise ConfigurationError("VoiceTut authentication is not configured")

        candidate = api_key or ""
        if authorization:
            scheme, _, value = authorization.partition(" ")
            if scheme.lower() == "bearer":
                candidate = value.strip()
        if not candidate or not any(hmac.compare_digest(candidate, key) for key in self._keys):
            raise AuthenticationError("Invalid or missing API key")
        return hashlib.sha256(candidate.encode("utf-8")).hexdigest()[:16]


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    retry_after: int = 0


@dataclass
class _Bucket:
    started: float
    requests: int = 0
    characters: int = 0


class FixedWindowQuota:
    """Thread-safe, bounded in-memory quota suitable for one RunPod worker."""

    def __init__(self, requests: int, characters: int, window_seconds: int = 60):
        if requests < 1 or characters < 1 or window_seconds < 1:
            raise ValueError("Quota values must be positive")
        self.requests = requests
        self.characters = characters
        self.window_seconds = window_seconds
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def consume(self, principal: str, characters: int, now: float | None = None) -> QuotaDecision:
        current = time.monotonic() if now is None else now
        with self._lock:
            bucket = self._buckets.get(principal)
            if bucket is None or current - bucket.started >= self.window_seconds:
                bucket = _Bucket(started=current)
                self._buckets[principal] = bucket

            if bucket.requests + 1 > self.requests or bucket.characters + characters > self.characters:
                retry = max(1, int(self.window_seconds - (current - bucket.started) + 0.999))
                return QuotaDecision(False, retry)

            bucket.requests += 1
            bucket.characters += characters
            if len(self._buckets) > 1024:
                cutoff = current - self.window_seconds
                self._buckets = {key: value for key, value in self._buckets.items() if value.started > cutoff}
            return QuotaDecision(True)


class Metrics:
    def __init__(self):
        self._lock = threading.Lock()
        self._started = time.time()
        self._counters = {
            "requests_total": 0,
            "synthesis_total": 0,
            "synthesis_failed": 0,
            "auth_rejected": 0,
            "quota_rejected": 0,
            "concurrency_rejected": 0,
            "characters_total": 0,
        }
        self._active = 0

    def increment(self, name: str, value: int = 1) -> None:
        with self._lock:
            self._counters[name] = self._counters.get(name, 0) + value

    def active(self, delta: int) -> None:
        with self._lock:
            self._active = max(0, self._active + delta)

    def snapshot(self) -> dict[str, int | float]:
        with self._lock:
            return {
                **self._counters,
                "active_synthesis": self._active,
                "uptime_seconds": round(time.time() - self._started, 3),
            }
