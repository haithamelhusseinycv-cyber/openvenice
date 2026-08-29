# Customized Production Surface

This fork intentionally exposes a reduced production surface.

## Active application tabs
- Chat
- Image

## Image workflow
- Generate
- Edit
- Face / Head / Body Swap
- Undress
- Upscale
- Background removal
- Generate-to-Edit / Swap / Undress handoff

## Allowed model families
The authoritative allowlists and defaults live in `src/lib/allowed-models.ts`.

## Reliability rules
- GET / HEAD requests may retry transient failures with backoff.
- Non-idempotent POST requests do not retry by default, to avoid duplicate paid generations/edits.
- `master` is validated by GitHub Actions using `npm ci`, `npm run lint`, and `npm run build`.

## Deployment
`railway.json` and the repository Railway integration deploy the current `master` build.
