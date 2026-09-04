# Failure Mode Acceptance Spec

- model unavailable → role-compatible fallback
- provider outage → alternate provider
- search failure → alternate search provider
- image failure → alternate image provider (if configured)
- tool failure → classified retry or alternate path
- network transient errors → bounded retry/backoff
