# Shahy WebUI

Production Open WebUI Pipe Function for the Shahy assistant.

## Architecture

`Shahy` calls Nube directly using `kimi-k2.6` as primary and makes exactly one eligible fallback attempt with `deepseek-v4-flash`. `nube-choice` remains independent.

Fallback is limited to HTTP 408, 425, 429, 5xx, network/timeout failures, and HTTP 400 responses that clearly indicate an unavailable, retired, unsupported, or missing model. Authentication, billing, and permission failures do not trigger fallback.

The provider key is read from the `NUBE_API_KEY` environment variable and is not stored in this repository.

## Deployment

- Open WebUI: `v0.11.3`
- Function ID: `shahy_kimi_k2_6_deepseek`
- Display name: `Shahy`
- Pipe version: `1.6.0`

Use the Pipe directly from the model selector. Do not create a Workspace Model whose `base_model_id` points to the Pipe.
