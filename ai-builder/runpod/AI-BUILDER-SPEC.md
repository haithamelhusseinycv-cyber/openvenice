# RunPod AI-Builder Deployment Specification

## Preserve existing workload

Before provisioning anything, enumerate current RunPod workloads and identify the existing Open WebUI workload. Do not delete, replace, resize, reimage, or detach its persistent storage.

## New workload

Create a separate pod named `AI-Builder`.

Target resources:

- Compute: CPU
- Target: approximately 8 vCPU / 16 GB RAM initially; choose the closest currently available CPU type after live catalog verification
- GPU: none for the builder itself
- Image: Ubuntu/Debian-compatible general-purpose image capable of running the bootstrap script
- HTTP port: `4096`
- Persistent storage mount: `/workspace`
- Persistent storage size: start around 100 GB unless current pricing/capacity indicates a better tier
- Restart behavior: persistent state must survive pod/container restarts

## Required environment secrets

Inject through RunPod secret/environment configuration; never place secret values in Git, Docker arguments, logs, or prompt text.

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

## Initialization

After the pod is reachable:

```bash
mkdir -p /workspace/projects
cd /workspace/projects
if [ ! -d openvenice/.git ]; then
  git clone https://github.com/haithamelhusseinycv-cyber/openvenice.git
fi
cd openvenice
git fetch origin infra/ai-builder-bootstrap
git checkout infra/ai-builder-bootstrap
bash ai-builder/scripts/bootstrap.sh
bash ai-builder/scripts/start.sh
bash ai-builder/scripts/verify.sh
```

After bootstrap, OpenCode Web should respond locally on `0.0.0.0:4096` and externally through the RunPod HTTP proxy for port 4096.

## External acceptance

Do not call the deployment complete merely because the pod is RUNNING.

Verify all of the following:

1. the RunPod pod is running;
2. `/workspace` is persistent and writable;
3. OpenCode Web responds locally with Basic Auth;
4. the RunPod proxy URL responds externally;
5. the Builder Max agent is visible/default;
6. OpenRouter authentication works and its live model catalog can be queried;
7. GitHub authentication can read the repository;
8. a disposable branch can be created/pushed/deleted only if the user-authorized token scope permits it and doing so does not affect production branches;
9. Hugging Face authentication works;
10. `runpodctl user` authenticates with the RunPod API key;
11. a trivial OpenCode task can read/write a disposable file under `/workspace/projects` and run a shell command;
12. stopping/restarting the OpenCode process does not lose project or session state.

## GPU inference separation

Do not add a GPU to `AI-Builder` just to run models. When self-hosted inference is introduced, create a separate on-demand GPU service/pod/serverless endpoint using vLLM or the selected serving stack. The builder connects to it over an authenticated OpenAI-compatible endpoint.
