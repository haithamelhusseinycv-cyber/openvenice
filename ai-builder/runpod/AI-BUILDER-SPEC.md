# RunPod AI-Builder Deployment Specification

## Preserve existing workload

Before provisioning anything, enumerate current RunPod workloads and identify the existing Open WebUI workload. Do not delete, replace, resize, reimage, restart, stop, or detach its persistent storage.

## New workload

Create a separate pod named `AI-Builder`.

Target resources:

- Compute: CPU
- Target: approximately 8 vCPU / 16 GB RAM initially; choose the closest currently available CPU flavor from the live RunPod catalog
- GPU: none for the builder itself
- Image: use a current x86-64 Ubuntu-based universal development image such as `mcr.microsoft.com/devcontainers/universal:noble`; resolve and record the exact image digest at deployment time rather than relying permanently on a mutable tag
- Container disk: approximately 25 GB (disposable; no important state may depend on it)
- HTTP port: `4096/http`
- Persistent storage mount: `/workspace`
- Persistent storage size: start around 100 GB unless current pricing/capacity indicates a materially better tier
- Restart behavior: the container start command must automatically relaunch OpenCode from the persistent checkout; no manual SSH step may be required after an ordinary pod restart

The RunPod container filesystem is disposable across pod/container restarts. Therefore source checkout, OpenCode application state, installed persistent npm tools, agent rules, model cache, artifacts, and user projects must live under `/workspace`.

## Required environment secrets

Inject through RunPod environment/secret configuration; never place secret values in Git, Docker arguments, logs, or prompt text.

- `RUNPOD_API_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY`
- `HF_TOKEN`
- `OPENCODE_SERVER_PASSWORD`

Optional non-secret values:

- `OPENCODE_SERVER_USERNAME=opencode`
- `GIT_USER_NAME=AI Builder`
- `GIT_USER_EMAIL=ai-builder@local.invalid`
- `WORKSPACE_ROOT=/workspace`

## Persistent OpenCode state

`ai-builder/scripts/bootstrap.sh` writes `ai-builder/state/runtime-paths.env` equivalents under `/workspace/state` and forces these categories onto persistent storage:

- OpenCode global config and global `AGENTS.md`
- OpenCode session/database/auth/log data (`XDG_DATA_HOME`)
- cache/state directories
- npm prefix containing the OpenCode binary and pnpm
- Git global configuration (without embedding credential values)
- Hugging Face/model cache

The effective paths must resolve below `/workspace`. `verify.sh` treats any ephemeral path as failure.

## First initialization

After the new pod and `/workspace` mount exist, keep the pod alive temporarily while bootstrapping (for example with a benign long-running shell command). Then execute:

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

Do not use the historical `infra/ai-builder-bootstrap` branch for deployment; PR #49 has been merged and `master` is the canonical source.

## Permanent container start behavior

After successful bootstrap, configure the **AI-Builder pod only** so its container starts the persistent foreground entrypoint automatically.

Equivalent RunPod start configuration:

- Docker entrypoint: `/bin/bash -lc`
- Docker start command: `exec bash /workspace/projects/openvenice/ai-builder/scripts/entrypoint.sh`

The exact API/CLI representation must follow the live RunPod tool schema. Do not hand-write a legacy API payload when MCP/runpodctl provides the operation.

`entrypoint.sh`:

1. refuses to run unless `/workspace` is a real mounted volume;
2. requires the five runtime secrets without printing them;
3. preserves an existing working tree and never hard-resets in-progress work;
4. bootstraps persistent OpenCode/tools if missing;
5. restores persistent runtime paths;
6. verifies `builder-max` is discoverable;
7. starts `opencode web --hostname 0.0.0.0 --port 4096` as PID 1/foreground process.

Using a foreground service is intentional: RunPod/Docker lifecycle and service health remain coupled. `scripts/start.sh` exists only for debugging/manual background startup.

## External acceptance

Do not call the deployment complete merely because the pod is RUNNING.

Verify all of the following:

1. the RunPod pod is running;
2. `/workspace` is a distinct persistent mount and writable;
3. OpenCode Web responds locally with Basic Auth;
4. an unauthenticated request is rejected;
5. the RunPod proxy URL for port 4096 responds externally;
6. a valid authenticated external request succeeds;
7. the `builder-max` agent is visible and is the configured default;
8. global private/mature/direct instructions are loaded from persistent config;
9. OpenRouter authentication works and its live model catalog can be queried;
10. GitHub authentication can read the repository and can perform a disposable write/push test within the token's authorized scope;
11. Hugging Face authentication works;
12. `runpodctl user` authenticates with the RunPod API key;
13. Git, GitHub CLI, shell, Python, Node/npm/pnpm, Java/adb, Chromium, ffmpeg, and Pandoc are available;
14. a trivial OpenCode task can read/write a disposable file under `/workspace/projects` and execute a shell command;
15. OpenCode session/state data is created under `/workspace/state`, not container-local home directories.

## Full restart persistence test

A process-only restart is insufficient.

Before completion:

1. create uniquely named marker files under `/workspace/state` and `/workspace/projects`;
2. record at least one OpenCode session/state artifact;
3. restart **only the AI-Builder pod/container** using the normal RunPod lifecycle;
4. verify the configured start command automatically brings port 4096 back without manual intervention;
5. verify all markers and OpenCode state remain;
6. rerun `ai-builder/scripts/verify.sh`;
7. recheck the external authenticated proxy endpoint.

Never restart the existing Open WebUI workload as part of this test.

## GPU inference separation

Do not add a GPU to `AI-Builder` just to run models. When self-hosted inference is introduced, create a separate on-demand GPU service/pod/serverless endpoint using vLLM or the selected serving stack. The builder connects to it over an authenticated OpenAI-compatible endpoint.

## Source-of-truth rule

GitHub remains version control only; it is not in the model inference path. Runtime state and in-progress work live on the RunPod persistent volume. Production-worthy configuration changes should still be committed back to the repository after verification.
