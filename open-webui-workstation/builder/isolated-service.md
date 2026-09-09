# Isolated Builder/Computer Service

Deploy builder tools in a separate service from the public Open WebUI container.

The reproducible RunPod contract is defined in
`runtime/open-terminal/runpod.yaml`. Its live deployment remains a separate
acceptance gate; this document alone does not mark it implemented.

Capabilities:
- terminal, filesystem, git, python, node, npm/pnpm
- browser automation (Playwright/Chromium)
- document/media processing tools
- build/test/debug stacks

Security boundary:
- No unrestricted arbitrary execution inside public OWUI container.
- Use isolated sandbox for package installs and untrusted code inspection.
- Use a distinct persistent volume; never mount Open WebUI's database volume.
- Require a high-entropy bearer key stored server-side.
- Do not mount the host Docker socket.
