# Open WebUI Workstation (Repository Canonical Package)

This directory is the canonical, reproducible package for configuring and operating the Open WebUI workstation.

## Scope
- Repository-first workstation configuration and operational policy.
- Modular prompt layers (global core, behavior, mode, model overlay).
- Model profiles, routing, fallback, refusal classification, and capability registry.
- Research, RAG, media, builder sandbox, mobile, security, monitoring, backup, and acceptance artifacts.

## Runtime Preservation Policy
The existing healthy Open WebUI runtime must be preserved. Configuration is applied via controlled updates only.

## Prompt Assembly
1. Hard platform/provider constraints
2. Global core
3. Global open/mature behavior
4. Reasoning/productivity mode
5. Model-specific overlay
6. Tool/task context
7. Current user request

## Implementation Phases
See `acceptance/requirements-matrix.yaml` and `acceptance/acceptance-suite.md`.
