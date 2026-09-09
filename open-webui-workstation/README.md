# Open WebUI Workstation (Repository Canonical Package)

This directory is the canonical, reproducible package for configuring and operating the Open WebUI workstation.

`runtime/live-state.yaml` is the authority for what has actually been verified
in production. Other files may describe a target or planned configuration and
must not be interpreted as deployment evidence.

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

## Current deployment priority

Deploy the isolated Open Terminal service specified in
`runtime/open-terminal/runpod.yaml`, connect it through Open WebUI's admin-side
Open Terminal integration, and complete the restart/persistence acceptance
test. This replaces the failing built-in Zen Responses tool loop without
weakening the Open WebUI container boundary.
