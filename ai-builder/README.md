# AI Builder

This directory defines the self-hosted engineering workstation that builds and maintains the user's Open WebUI and other authorized projects.

## Architecture

- Existing Open WebUI workload: **preserve; do not recreate, restart, or delete**.
- New `AI-Builder` RunPod CPU workload: persistent `/workspace` + OpenCode Web + development tools.
- Optional separate GPU inference workloads: vLLM/open-weight models and image services.
- GitHub is source/version control only; it is not in the inference path.
- The disposable RunPod container filesystem is never treated as durable state.

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

The builder refuses production startup unless `/workspace` is a real mounted volume.

```text
/workspace/
├── projects/
│   └── openvenice/
├── state/
│   ├── xdg/
│   │   ├── config/opencode/    # global config, AGENTS.md, custom agents
│   │   ├── data/opencode/      # sessions, auth/provider state, logs/database
│   │   ├── cache/opencode/
│   │   └── state/opencode/
│   ├── gitconfig
│   └── bootstrap-versions.txt
├── tools/
│   ├── npm/                    # persistent OpenCode + pnpm
│   └── bin/
├── artifacts/
├── models/
├── logs/
└── backups/
```

All serious project work belongs below `/workspace/projects`.

## Deployment source

`master` is the canonical deployment source. PR #49 landed the initial bootstrap. Do not deploy the historical bootstrap branch.

Detailed provisioning and acceptance requirements are in:

- `runpod/AI-BUILDER-SPEC.md`
- `CODEX-BOOTSTRAP.md`

## Bootstrap and production startup

On the new AI-Builder pod only, after `/workspace` is mounted:

```bash
mkdir -p /workspace/projects
cd /workspace/projects
git clone https://github.com/haithamelhusseinycv-cyber/openvenice.git || true
cd openvenice
git checkout master
git pull --ff-only origin master
bash ai-builder/scripts/bootstrap.sh
```

For production lifecycle, configure the RunPod container to run:

```bash
exec bash /workspace/projects/openvenice/ai-builder/scripts/entrypoint.sh
```

`entrypoint.sh` runs OpenCode Web in the foreground on `0.0.0.0:4096`. This makes container health and OpenCode health part of the same lifecycle. `scripts/start.sh` is retained for debugging/manual background startup, not as the permanent container lifecycle.

## Verification

From another shell/process while OpenCode Web is running:

```bash
cd /workspace/projects/openvenice
bash ai-builder/scripts/verify.sh
```

Verification checks include:

- `/workspace` is an actual distinct mount and writable;
- required secrets are present without printing their values;
- OpenCode and core development tools are available;
- OpenCode XDG data/config/cache/state paths are rooted under `/workspace`;
- `builder-max` is discoverable;
- OpenCode Web responds locally with Basic Auth;
- GitHub authentication works;
- OpenRouter returns its live model catalog;
- Hugging Face authentication works;
- RunPod CLI authentication works.

Deployment is not complete until the external RunPod proxy is tested and a **full AI-Builder restart** proves that OpenCode relaunches automatically while project/session markers remain. A process-only restart is not sufficient.

## Operating principle

The permanent OpenCode agent is configured for continuous autonomous execution of ordinary reversible engineering actions. It should return to the user only for genuine human-only authentication, missing credentials, materially ambiguous product decisions, irreversible/high-impact operations, material new cost, or completion.

The agent must not claim completion until the requested outcome is actually tested and verified.

## Versioning policy

OpenCode changes quickly. Bootstrap installs the current stable `opencode-ai` release into persistent tool storage and records the installed version. Upgrades should be deliberate and followed by acceptance tests.

Do not hard-code speculative model IDs. Model/provider IDs and capabilities must be verified live before they are promoted into default routing.
