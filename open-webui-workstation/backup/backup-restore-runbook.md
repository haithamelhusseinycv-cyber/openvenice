# Backup and Restore Runbook

Targets:
- Open WebUI database
- `/app/backend/data` persistent volume
- prompts/profiles/routing/tool configuration artifacts

Process:
1. Scheduled backup snapshot.
2. Integrity check.
3. Restore drill in test context.
4. Verify app startup, model config, and critical workflows.

Note: A backup without restore test is not accepted as complete.
