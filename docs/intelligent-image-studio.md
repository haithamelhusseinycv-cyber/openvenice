# Chilli intelligent image workflow

Restores the October 3–4 design with a single Best Studio and conversational tool. Advanced contains individual engines.

Upload an original and up to two references; describe the result. Actual pixel analysis measures source dimensions, luminance, clipped highlights/shadows, transparency and sampled edge variance. These metrics do not claim subject recognition, anatomy or blur certainty. Live Venice vision reasoning understands the supplied photos and prompt, discovers supported catalogs and returns a validated semantic intent. Only existing model IDs and supported operations are accepted. Image text is untrusted.

FaceFusion handles explicit face swaps/restoration and available frame enhancement. Swaps need exactly one face in each original/reference; ambiguous targets stop. Unrequested restoration stays off. Easy phone uses downloaded model-specific steps/CFG/scheduler and supported output aspect ratio, retaining distilled-model defaults. Venice creation selects from the current image catalog and advertised defaults; editing uses the existing provider endpoints. Precise localized and composite operations use Easy cloud Auto, whose durable visual planner, validated Best graph settings, masks, version history and review remain authoritative.

The Studio saves originals and candidates separately, supports Undo and Refine, and compares outputs against the request and originals using visual reasoning. Missing or contradictory visual review returns needs_review; it never fabricates aesthetic scores or promises perfect output. Refinement is a new explicit user action, preventing unbounded paid repair loops. Cloud estimate limit is $0.25 per submission; Venice uses the configured account credits. Ten-minute foreground deadline, existing cloud idempotency/reconnect/cancel and companion deadlines apply.

Runtime prerequisites: connected Venice inference credential with access to a suitable vision/multi-image model; downloaded Easy model for phone generation; companion host for FaceFusion; Vast credit for cloud generation. Offline pixel facts alone cannot establish scene meaning. Existing production credential and credit blockers are unchanged.

Verification: pure planner tests plus mocked execution tests validate photo payloads, vision capability selection, live model setting forwarding, original/reference order, ambiguous-face rejection and contradictory-review handling. These are wiring tests, not fresh paid inference or aesthetic validation.
