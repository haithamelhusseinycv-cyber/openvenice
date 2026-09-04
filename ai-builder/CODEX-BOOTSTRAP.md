# CODEX MISSION — DEPLOY AI-BUILDER END TO END

Execute this mission continuously. Do not stop for routine reversible implementation steps.

## Objective

Provision and verify a separate persistent RunPod CPU workload named `AI-Builder` that runs OpenCode Web as the user's permanent autonomous engineering workstation.

The existing Open WebUI workload is unrelated production infrastructure. Preserve it completely.

## Required secrets

The execution environment must already contain:

- `RUNPOD_API_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY`
- `HF_TOKEN`
- `OPENCODE_SERVER_PASSWORD`

Never print, echo, commit, paste into logs, or expose their values.

## Authority

You are authorized to perform ordinary reversible engineering actions required to complete this mission: inspect RunPod, create the new builder workload and persistent storage, install dependencies, clone the repository, configure OpenCode, start/restart the new builder service, inspect logs, debug, retry, and verify.

Do not ask for confirmation between normal steps.

Stop only for a genuine human-only authentication requirement, missing secret, material new paid commitment outside the expected RunPod builder cost, irreversible destructive action, or successful completion.

## 1. Verify RunPod control plane first

Use the official RunPod MCP/CLI path, not hand-written legacy REST calls.

Run a real authentication check (`runpodctl user` or equivalent structured MCP call).

Enumerate current pods, volumes, endpoints, relevant CPU catalog entries, and current pricing/availability.

Identify the existing Open WebUI workload and record its ID/status/storage without modifying, stopping, restarting, resizing, or reimaging it.

If an `AI-Builder` workload already exists, inspect and reuse/repair it rather than creating a duplicate.

## 2. Persistent storage

Create or reuse a dedicated persistent/network volume for `AI-Builder` only.

Target approximately 100 GB initially unless live pricing/capacity makes a nearby size materially more sensible.

Mount it at:

`/workspace`

Do not reuse, detach, resize, or modify the Open WebUI volume.

The deployment is invalid if `/workspace` is merely a writable directory on disposable container storage.

## 3. Create AI-Builder

Create a separate CPU pod named:

`AI-Builder`

Target approximately 8 vCPU / 16 GB RAM. Select the closest currently available CPU type from the live RunPod catalog.

No GPU is required for this pod.

Expose:

`4096/http`

Use a current x86-64 Ubuntu-based universal development image such as:

`mcr.microsoft.com/devcontainers/universal:noble`

Resolve and record the exact image digest at deployment time. Prefer an immutable digest once selected rather than permanently relying on a mutable tag.

Inject the required secrets as environment variables without exposing their values.

Initially keep the new pod alive with a benign temporary start command long enough to clone/bootstrap the persistent workspace.

## 4. Bootstrap from canonical repository state

The canonical deployment source is now:

- repository: `haithamelhusseinycv-cyber/openvenice`
- branch: `master`

PR #49 has already been merged. Do **not** deploy the historical `infra/ai-builder-bootstrap` branch.

Inside the new AI-Builder only:

```bash
mkdir -p /workspace/projects
cd /workspace/projects
if [ ! -d openvenice/.git ]; then
  git clone https://github.com/haithamelhusseinycv-cyber/openvenice.git
fi
cd openvenice
git fetch origin master
git checkout master
git pull --ff-only origin master
bash ai-builder/scripts/bootstrap.sh
```

If a package name or upstream installation detail has changed, research current official documentation, make the smallest reliable correction on a dedicated branch, test it, commit it, merge it after CI, update the persistent checkout, and continue.

Do not abandon the mission because one dependency or command changed.

## 5. Configure permanent restart-safe startup

After bootstrap succeeds, configure the **AI-Builder pod only** so an ordinary RunPod container/pod restart automatically executes the persistent entrypoint.

Desired behavior is equivalent to:

- Docker entrypoint: `/bin/bash -lc`
- Docker start command: `exec bash /workspace/projects/openvenice/ai-builder/scripts/entrypoint.sh`

Use the exact live RunPod MCP/runpodctl schema for `dockerEntrypoint`/`dockerStartCmd`; do not guess stale CLI flags.

Then restart only AI-Builder once to prove the normal lifecycle uses this startup path.

The foreground `entrypoint.sh` must be the long-running process. Do not depend on `nohup` as the production lifecycle.

## 6. OpenCode configuration and persistence

Confirm:

- current stable OpenCode is installed in persistent tool storage under `/workspace/tools`;
- global config/rules are below persistent `XDG_CONFIG_HOME` under `/workspace/state`;
- session/database/auth/log data are below persistent `XDG_DATA_HOME` under `/workspace/state`;
- cache/state directories are also below `/workspace/state`;
- `builder-max` exists, is discoverable, and is the default primary agent;
- the global private/mature/direct policy is loaded;
- session sharing is disabled;
- broad ordinary reversible builder permissions are enabled;
- OpenCode Web is protected with Basic Auth;
- OpenCode listens on `0.0.0.0:4096`;
- `OPENCODE_SERVER_PASSWORD` is never present in repository files or command output.

Do not hard-code speculative frontier model IDs.

Verify OpenRouter connectivity and retrieve the live model catalog. Record current candidate coding/reasoning models for the later routing phase rather than inventing IDs.

## 7. Tool verification

Run `ai-builder/scripts/verify.sh` and independently verify where necessary:

- Git read/write capability to the authorized repository;
- GitHub CLI/API authentication;
- shell execution;
- Python;
- Node/npm/pnpm;
- browser/Chromium availability;
- ffmpeg;
- Pandoc;
- Java/adb baseline;
- Hugging Face authentication;
- RunPod CLI authentication;
- persistent file read/write;
- OpenCode agent discovery.

Use disposable test files/branches where needed. Do not modify production code merely for an acceptance test.

## 8. External service verification

A RunPod pod reporting `RUNNING` is not completion.

Obtain the real RunPod proxy URL for port 4096 and verify from outside the pod:

1. the endpoint is reachable;
2. an unauthenticated request is rejected;
3. a correctly authenticated request succeeds;
4. the returned page/service is OpenCode Web, not a generic proxy/container response.

## 9. Full persistence/restart test

A process-only restart is not sufficient.

Before restart:

- create unique marker files under `/workspace/state` and `/workspace/projects`;
- establish at least one OpenCode state/session artifact;
- record checksums/identifiers without exposing secrets.

Then restart **only AI-Builder** through its normal RunPod lifecycle.

After restart, without manual in-container startup:

- port 4096 must come back automatically;
- markers must remain;
- OpenCode state/session data must remain;
- `builder-max` must remain discoverable/default;
- `ai-builder/scripts/verify.sh` must pass again;
- the authenticated external proxy must work again.

Do not restart the existing Open WebUI workload.

## 10. Repository handling

GitHub is source/version control only; it is not part of model inference.

Any deployment fixes must be made on a dedicated branch from `master`, validated by repository CI, and merged only after checks pass. Do not maintain deployment against a stale historical branch.

Do not expose secrets in commits, PR text, logs, screenshots, shell tracing, or generated artifacts.

## 11. Completion gate

Do not finish until all critical checks are true:

- RunPod control plane authenticated;
- existing Open WebUI positively identified and preserved;
- dedicated AI-Builder pod exists;
- dedicated persistent storage is a real mount at `/workspace`;
- OpenCode Web starts automatically after AI-Builder restart;
- external proxy works;
- unauthenticated access is rejected;
- authenticated access succeeds;
- Builder Max policy is loaded;
- OpenCode config/session state is persistent;
- GitHub access works;
- OpenRouter catalog works;
- Hugging Face authentication works;
- RunPod CLI works;
- required development tools work;
- persistence is verified after a full AI-Builder restart;
- outstanding limitations are precisely documented.

Then report only:

COMPLETED
RUNTIME
PERSISTENCE
OPENCODE
TOOLS
MODELS VERIFIED
OPEN WEBUI PRESERVATION
REPOSITORY
LIMITATIONS

Include concrete AI-Builder pod/volume IDs, proxy URL, image digest, OpenCode version, repository commit/PR status, and verification evidence. Never include secret values.
