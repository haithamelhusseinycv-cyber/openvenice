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

Enumerate current pods, volumes, endpoints, and relevant CPU catalog entries.

Identify the existing Open WebUI workload and record its ID/status/storage without modifying it.

## 2. Persistent storage

Create or reuse a dedicated persistent/network volume for `AI-Builder` only.

Target approximately 100 GB initially unless live pricing/capacity makes a nearby size materially more sensible.

Mount it at:

`/workspace`

Do not reuse or detach the Open WebUI volume.

## 3. Create AI-Builder

Create a separate CPU pod named:

`AI-Builder`

Target approximately 8 vCPU / 16 GB RAM. Select the closest currently available CPU type from the live RunPod catalog.

No GPU is required for this pod.

Expose HTTP port:

`4096/http`

Use a stable Ubuntu/Debian-compatible image suitable for the repository bootstrap scripts.

Inject the required secrets as environment variables without exposing their values.

## 4. Bootstrap

Once the pod is reachable, execute the repository bootstrap described in:

`ai-builder/runpod/AI-BUILDER-SPEC.md`

Use branch:

`infra/ai-builder-bootstrap`

Run:

- `ai-builder/scripts/bootstrap.sh`
- `ai-builder/scripts/start.sh`
- `ai-builder/scripts/verify.sh`

If a package name or upstream installation detail has changed, research the current official documentation, make the smallest reliable correction on this branch, test it, commit it, and continue.

Do not abandon the mission because one dependency or command changed.

## 5. OpenCode configuration

Confirm:

- OpenCode stable is installed;
- persistent config/state is under `/workspace/state`;
- `builder-max` exists and is the default agent;
- the global private-agent policy is loaded;
- session sharing is disabled;
- broad ordinary reversible builder permissions are enabled;
- OpenCode Web is protected with Basic Auth;
- OpenCode listens on `0.0.0.0:4096`.

Do not hard-code speculative frontier model IDs.

Verify OpenRouter connectivity and retrieve the live model catalog. Record candidate coding/reasoning models for the next routing phase rather than inventing IDs.

## 6. Tool verification

Verify at minimum:

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
- persistent file read/write.

Use disposable test files/branches where needed. Do not modify production code merely for an acceptance test.

## 7. External service verification

A RunPod pod reporting `RUNNING` is not completion.

Verify the OpenCode login/web page from outside the pod using the RunPod proxy URL for port 4096.

Confirm authentication is required.

Confirm a valid authenticated request succeeds.

## 8. Persistence test

Create a disposable marker and OpenCode/session state below `/workspace`, restart only the new OpenCode process (or the new AI-Builder pod if safe and necessary), and confirm the persistent data remains.

Do not restart the existing Open WebUI workload.

## 9. Repository handling

Keep GitHub only as source/version control; it is not part of model inference.

If bootstrap fixes are required, commit them to `infra/ai-builder-bootstrap` and update PR #49.

Do not expose secrets in commits or PR text.

## 10. Completion gate

Do not finish until all critical checks are true:

- RunPod control plane authenticated;
- existing Open WebUI preserved;
- dedicated AI-Builder pod exists;
- dedicated persistent storage is mounted at `/workspace`;
- OpenCode Web starts successfully;
- external proxy works;
- Basic Auth works;
- Builder Max policy is loaded;
- GitHub access works;
- OpenRouter catalog works;
- Hugging Face authentication works;
- RunPod CLI works;
- development tools work;
- persistence is verified after restart;
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

Include concrete pod/volume IDs, proxy URL, OpenCode version, PR status, and verification evidence. Never include secret values.
