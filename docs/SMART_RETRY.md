# Smart image retry

OpenVenice image artifacts expose four retry modes instead of a blind re-run:

- **Repeat task** — repeats the most recent image task using the same tool/model family where available.
- **New seed** — repeats the most recent image task but explicitly requests a new random seed.
- **Improve result** — uses the current rendered artifact as the reference and asks the agent to preserve identity/composition while correcting realism, anatomy, lighting, texture, and visible artifacts.
- **Change settings** — uses the current artifact as context and asks the user which generation/edit settings should change before another tool call.

These are agent-level retries. OpenVenice does not claim exact parameter replay because full raw tool payloads are deliberately not persisted into chat history.
