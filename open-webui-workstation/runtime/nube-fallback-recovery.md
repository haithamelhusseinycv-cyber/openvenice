# Shahy — Nube / LiteLLM Fallback Recovery

## Objective

Repair the runtime model routing so that:

- Kimi K2.6 is attempted directly.
- Only if Kimi fails for an eligible transient/provider-availability reason, retry exactly once on DeepSeek V4 Flash.
- Nube Choice remains an independent AUTO/provider-choice route and is not part of the Kimi fallback chain.
- Authentication, billing/permission, user-abort, and partial-output failures never trigger a fallback.

This procedure is intentionally runtime-safe. It does not recreate the Open WebUI pod, delete persistent data, rotate `WEBUI_SECRET_KEY`, or alter unrelated workloads.

## Root cause to verify

The observed LiteLLM error is consistent with a fallback map whose key does not exactly match the request's **model-group name**.

Keep these two identifiers separate:

1. **LiteLLM model-group / request name** — the `model_name` exposed to Open WebUI and the value LiteLLM reports as `original_model_group` when fallback lookup fails.
2. **Nube upstream model ID** — the exact provider model identifier placed inside that group's provider mapping (for example in `litellm_params.model`).

The fallback map must be keyed by the LiteLLM **model-group name**, not blindly by the provider's upstream model ID.

Treat the live Nube `/v1/models` response as the source of truth only for the case-sensitive **upstream provider IDs**.

## Step 1 — discover exact Nube upstream IDs

On a trusted shell that has the Nube key available as an environment variable:

```bash
export NUBE_API_KEY='...'
python3 open-webui-workstation/runtime/nube-model-probe.py
```

The probe is read-only and does not print the key.

Record the exact returned upstream IDs for:

- `KIMI_K2_6`
- `DEEPSEEK_V4_FLASH`
- `NUBE_CHOICE`

If any target is reported as `NOT_FOUND`, stop. Do not guess the provider ID.

## Step 2 — snapshot live routing before mutation

Before editing the Open WebUI / LiteLLM model registry, export or copy the current provider/model/fallback configuration so it can be restored exactly.

Do not recreate the pod or persistent volume as a shortcut.

## Step 3 — identify the live LiteLLM model-group names

Read the existing LiteLLM/Open WebUI model registry and the actual error text.

For each route, capture both fields:

| Route | LiteLLM model-group / request name | Nube upstream provider ID |
| --- | --- | --- |
| Kimi K2.6 | use the live `model_name` / `original_model_group` value | exact ID from Step 1 |
| DeepSeek V4 Flash | use the live `model_name` value | exact ID from Step 1 |
| Nube Choice | use the live `model_name` value | exact ID from Step 1 |

Example only:

```yaml
model_list:
  - model_name: kimi-k2.6        # fallback key uses this group name
    litellm_params:
      model: <EXACT_NUBE_KIMI_UPSTREAM_ID>

  - model_name: deepseek-v4-flash
    litellm_params:
      model: <EXACT_NUBE_DEEPSEEK_UPSTREAM_ID>
```

Do not rename working model groups merely to make them look like provider IDs. The safest recovery is to preserve the request names Open WebUI already uses and correct the provider mapping/fallback map around them.

## Step 4 — install one-hop fallback

If the Kimi error reports, for example:

```text
original_model_group=kimi-k2.6
```

then the fallback map must be keyed by that exact group name:

```yaml
fallbacks:
  - kimi-k2.6:
      - deepseek-v4-flash
```

Use the **actual live Kimi and DeepSeek model-group names** in place of the example values above.

Constraints:

- maximum fallback depth: `1`
- no recursion
- no DeepSeek -> Kimi reverse fallback
- no Nube Choice participation in this chain
- no fallback fan-out to multiple models during recovery

## Step 5 — eligible and ineligible failures

Fallback is allowed only for transient/provider-availability failures such as:

- HTTP 408
- HTTP 425
- HTTP 429
- HTTP 5xx
- provider/model-unavailable 400-class responses that occur before inference and explicitly indicate that the requested model is unavailable, retired, or temporarily unsupported

Never fallback on:

- HTTP 401
- HTTP 402
- HTTP 403
- explicit user abort/cancel
- a response that already emitted partial model output
- malformed local request/configuration errors

If the deployed LiteLLM version cannot enforce this exact status/exception policy natively, implement the guard in the surrounding proxy/router layer rather than broadening the fallback set.

## Step 6 — validation matrix

Run these in order after applying the live registry change:

| Test | Expected result |
| --- | --- |
| Direct DeepSeek request | `DEEPSEEK_OK` |
| Direct Kimi request | `KIMI_DIRECT_OK` |
| Normal Kimi 503/provider outage | exactly one DeepSeek retry and successful reply |
| Simulated Kimi transient failure | exactly one DeepSeek retry |
| Simulated Kimi 401/403 | clean auth/permission failure, zero fallback attempts |
| User cancellation | request stops, zero fallback attempts |
| Nube Choice direct request | stays independent; no Kimi -> DeepSeek chain is invoked |

Inspect LiteLLM's attempted-fallback metadata/logging where available and confirm the count is exactly one for the eligible-failure cases.

## Acceptance criteria

Recovery is complete only when all of the following are true:

1. The exact live Nube upstream IDs are recorded.
2. The Kimi fallback key exactly matches the model group LiteLLM receives/reports as `original_model_group`.
3. Kimi direct succeeds when healthy.
4. DeepSeek direct succeeds.
5. A transient Kimi failure produces exactly one DeepSeek attempt.
6. A 401/402/403 produces zero fallback attempts.
7. Nube Choice remains independent.
8. Existing Open WebUI data, persistent storage, and `WEBUI_SECRET_KEY` continuity are preserved.

## Rollback

If any validation fails:

1. Restore the snapshot from Step 2.
2. Restart only the routing/proxy process if technically required by that configuration mechanism.
3. Do not rebuild or recreate the Open WebUI pod merely to restore routing.
4. Re-run direct Kimi and DeepSeek tests to confirm the pre-change state is restored.
