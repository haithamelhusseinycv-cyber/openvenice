# Authorized Mobile App Customization Workflow

Source-first:
inspect source → identify framework → targeted patch → rebuild → sign test build → install/test → iterate.

APK analysis (authorized contexts):
manifest/resources/components/flags/config/urls/storage behavior.

Guardrails:
- Preserve stability and user data.
- Prefer minimal patches.
- Maintain patch records for upstream upgrades.
- Do not treat DRM/license/account/security bypass as ordinary customization.
