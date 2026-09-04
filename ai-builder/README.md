# AI Builder Bootstrap

This directory defines the self-hosted engineering workstation that will build and maintain the user's Open WebUI and other authorized projects.

## Architecture

- Existing Open WebUI workload: **preserve; do not recreate or delete**.
- New `AI-Builder` RunPod CPU workload: persistent workspace + OpenCode Web + development tools.
- Optional separate GPU inference workloads: vLLM/open-weight models and image services.
- GitHub is used as version control only; it is not in the inference path.

## Required secrets

Inject these at runtime through RunPod/environment secret configuration. Never commit their values.

- `RUNPOD_API_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY`
- `HF_TOKEN`
- `OPENCODE_SERVER_PASSWORD`

Optional later:

- `VLLM_API_KEY`
- direct provider keys
- Microsoft Graph/OAuth credentials

## Persistent layout

The builder expects `/workspace` to be persistent storage.

```text
/workspace/
├── projects/
├── state/
│   ├── opencode-config/
│   └── opencode-data/
├── tools/
├── artifacts/
├── models/
├── logs/
└── backups/
```

OpenCode configuration is copied/symlinked into persistent state during bootstrap. Project work must live below `/workspace/projects`.

## Bootstrap

On a fresh Ubuntu/Debian-based RunPod CPU pod with `/workspace` mounted persistently:

```bash
cd /workspace
# clone this repository or copy ai-builder/ to the pod
bash ai-builder/scripts/bootstrap.sh
```

Then start the service:

```bash
bash ai-builder/scripts/start.sh
```

OpenCode Web listens on port `4096`. RunPod should expose it as an HTTP port through the proxy.

## Verification

```bash
bash ai-builder/scripts/verify.sh
```

The verification script checks:

- persistence path exists and is writable
- required secrets are present without printing them
- OpenCode is installed
- Git and developer runtimes are available
- OpenCode Web responds locally
- GitHub authentication can read the configured repository
- OpenRouter responds to a models request
- Hugging Face token can access the authenticated identity endpoint

## Operating principle

The permanent OpenCode agent is configured for continuous autonomous execution of ordinary reversible engineering actions. It should return to the user only for genuine human-only authentication, missing credentials, materially ambiguous product decisions, irreversible/high-impact operations, or completion.

The agent must not claim completion until the requested outcome is actually tested and verified.

## Versioning policy

OpenCode changes quickly. Bootstrap installs the latest stable `opencode-ai` release, records the installed version, and keeps application policy in project-scoped Markdown agent files so it can be migrated without losing the user's rules.

Do not hard-code speculative model IDs. Model/provider IDs and capabilities must be verified live before they are promoted into default routing.