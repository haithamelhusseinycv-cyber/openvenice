# Apply notes

## What this environment can do right now

Available secret: `RUNPOD_API_KEY` only.

**Missing (required for live Phase 1+):**

- Open WebUI admin session (onboarding still `true`)
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY` (STT/TTS/embeddings/images)
- `EXA_API_KEY`, `TAVILY_API_KEY`
- Optional Graph/GitHub/MiniMax keys

## Why Phase 1 is not fully applied on the pod yet

1. Open WebUI authenticated Admin APIs return 401 until onboarding completes.  
2. RunPod GraphQL in this account does not expose a simple `podUpdateEnv` mutation; changing env typically means template/recreate or console edit.  
3. Provider keys are not present in the agent environment, so connections cannot be configured server-side without you pasting them into Admin UI or pod env.

## Recommended apply path (human + agent)

1. You open https://c7togjwbwnqjqi-8080.proxy.runpod.net and finish admin signup.  
2. You add secrets in RunPod pod env **or** Admin → Connections (preferred for OWUI PersistentConfig):  
   - OpenRouter key + base URL  
   - OpenAI key for audio/embeddings/images  
   - Exa + Tavily  
3. You (or the agent with an admin JWT) import the two Functions from `functions/`.  
4. Follow `config/admin-checklist.md`.  
5. Run `scripts/verify_live.sh`.

## Pod sizing note

Architecture target: ~4 vCPU / 8 GB CPU.  
Current pod flavor is the existing healthy CPU instance with network volume — **keep it** unless you explicitly want a resize (new deploy + same volume).

## Do not

- Put `RUNPOD_API_KEY` into Open WebUI  
- Recreate/stop unrelated pods  
- Expose OpenRouter/OpenAI keys to the browser  
- Make Council the default model  
