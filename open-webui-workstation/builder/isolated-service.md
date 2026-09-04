# Isolated Builder/Computer Service

Deploy builder tools in a separate service from the public Open WebUI container.

Capabilities:
- terminal, filesystem, git, python, node, npm/pnpm
- browser automation (Playwright/Chromium)
- document/media processing tools
- build/test/debug stacks

Security boundary:
- No unrestricted arbitrary execution inside public OWUI container.
- Use isolated sandbox for package installs and untrusted code inspection.
