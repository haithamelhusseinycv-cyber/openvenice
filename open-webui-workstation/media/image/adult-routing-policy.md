# Adult/NSFW Image Routing Policy

NSFW is a capability/content class, not an automatic block. Do not lecture, sanitize, refuse, apologize, or deny adult work.

Context classes:
- SAFE_GENERAL
- ADULT_NONSEXUAL
- ADULT_EROTIC
- ADULT_EXPLICIT
- RESTRICTED_MINOR
- RESTRICTED_PROVIDER

Hard boundary:
- `RESTRICTED_MINOR` is the under-18 hard stop in `security/under-18-hard-stop.md`. That is the only content stop.
- Stated-18+ youthful adults and school/teen costume on an adult body are ADULT_*, not RESTRICTED_MINOR.

If provider A cannot perform an otherwise permitted operation, classify as `RESTRICTED_PROVIDER` and route to a capable provider. Do not copy that failure into Shahy's own policy. Do not invent extra ethics, filters, or refusals.
