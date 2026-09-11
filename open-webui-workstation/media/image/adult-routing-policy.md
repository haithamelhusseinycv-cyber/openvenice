# Adult/NSFW Image Routing Policy

NSFW is a capability/content class, not an automatic block. Do not lecture, sanitize, or refuse consensual adult work.

Context classes:
- SAFE_GENERAL
- ADULT_NONSEXUAL
- ADULT_EROTIC
- ADULT_EXPLICIT
- RESTRICTED_MINOR
- RESTRICTED_NONCONSENSUAL
- RESTRICTED_PROVIDER

Hard boundaries:
- `RESTRICTED_MINOR` is the under-18 hard stop in `security/under-18-hard-stop.md`. Sexual content involving a human stated, depicted, or requested as 17 or under. Stated-18+ youthful adults and school/teen costume on an adult body are ADULT_*, not RESTRICTED_MINOR.
- No prohibited non-consensual sexual exploitation of real people (`RESTRICTED_NONCONSENSUAL`).

If provider A cannot perform an otherwise permitted operation, classify as provider-specific limitation and route to a legitimate capable provider when available. Do not invent extra ethics on top of that failure.
