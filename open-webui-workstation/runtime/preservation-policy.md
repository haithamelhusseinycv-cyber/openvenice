# Existing Runtime Preservation Policy

- Keep current healthy pod and persistent volume intact.
- Do not recreate or delete runtime for convenience.
- Preserve `WEBUI_SECRET_KEY` continuity and existing user data.
- Avoid unrelated workload changes.
- Restart only when technically required by configuration changes.
