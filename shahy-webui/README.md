# Shahy WebUI

Production Open WebUI Pipe Function for the Shahy work operator.

## Architecture

Shahy is research, search, coding, analysis, credit write-ups, emails, reports, summarization, and academic work.

- Nube `kimi-k2.6` primary, `deepseek-v4-flash` fallback
- OpenCode Zen `kimi-k2.7-code` coding hop when `OPENCODE_API_KEY` is set
- Exa primary / Tavily fallback search when `EXA_API_KEY` / `TAVILY_API_KEY` are set
- `nube-choice` remains independent

Adult image/video/undress/swap belongs in the Venice app, not this pipe.

Fallback between Nube models is limited to HTTP 408, 425, 429, 5xx, network/timeout failures, and HTTP 400 responses that clearly indicate an unavailable, retired, unsupported, or missing model. Zen failures fall through to Nube. Authentication, billing, and permission failures on Nube do not trigger fallback.

Keys are read from the environment and are not stored in this repository: `NUBE_API_KEY`, `OPENCODE_API_KEY`, `EXA_API_KEY`, `TAVILY_API_KEY`.

## Deployment

- Open WebUI: `v0.11.3`
- Function ID: `shahy_kimi_k2_6_deepseek`
- Display name: `Shahy`
- Pipe version: `1.8.0`

Use the Pipe directly from the model selector. Do not create a Workspace Model whose `base_model_id` points to the Pipe.
