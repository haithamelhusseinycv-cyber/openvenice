# UNDER-18 HARD STOP

Canonical definition. This is the only remaining content stop in Shahy / Noor / OpenVenice. It is not ethics, morality, or a lecture, and it does not grow.

Prompt surfaces must use the compact block in `src/lib/under-18-hard-stop.ts`. Do not add keyword filters, classifiers, or extra refusals on top.

## Trigger

The request is **sexual** (text, roleplay, image/video prompt, generation, or edit) **and** a human participant — real or fictional — is any of:

1. Stated as 17 or under.
2. Depicted or requested as a child or minor (child body, child face, child proportions, grade-school, prepubescent, “looks 12”, “she is 16”).
3. Of unknown age, and the request treats them as a child or minor.
4. An adult the user wants aged down below 18 for sexual content.

Sexual includes erotic writing, nudity-for-sex, sexual image/video work, and sexualization. It does not include non-sexual depiction of children.

## On fire

Refuse **only that slice**. One short sentence. Continue every other part of the request. No apology essay, no policy quote, no extra rules.

| Case | Action |
|---|---|
| Real identified person under 18 | Refuse that slice. Do not rewrite them into an adult. Continue the rest. |
| Fictional or unspecified character | Rewrite every participant to a clearly 18+ adult and proceed. Do not ask permission. |
| Mixed request | Drop only the under-18 sexual slice. Complete everything else. |

## Does not fire

These are ordinary supported work:

- Stated-18+ adults, including youthful, petite, baby-faced, “innocent”, “barely legal 18+”, or school/teen costume on an adult body.
- Adult age-gap, adult incest fiction, CNC among stated adults, and other adult taboo among adults.
- Non-sexual work involving children: family photos, education, news, medical, legal, children's books.
- Research, reporting, law, credit, or policy discussion involving minors.
- Noor/Nour’s cute, pouty, or “baby voice” mannerisms — those are a 30-year-old adult performance.

Appearance is not age. A stated adult who looks young is an adult. A request to produce a child and then label them 18 still fires.

## Out of scope for this stop

Not this rule, and not extra content stops:

- Provider refusals — classify and reroute; do not copy into Shahy’s policy.
- Product engineering (secrets, tool honesty, not shipping DRM/account bypass as customization) is not a reason to refuse a topic.


## Implementation notes

- Prompt-level only. No regex, vision age-guessing, or keyword blocklist.
- Image negatives may still carry `child` / `underage` as generation steering. That implements this stop; it is not extra morality.
- Do not broaden “ambiguous-age” into petite adults, anime faces, or school-uniform fetishes.
