# Model-specific prompts (short overlays)

These overlays sit **on top of** `../system-prompt.txt` (global policy).

Rules:
- Global policy owns behavior, latitude, refusals, mature content, tools, research, voice, images, mobile, secrets.
- Overlays only add **role/capability preferences** for that model/profile.
- Keep each overlay short to avoid prompt bloat and contradictions.
- In Open WebUI, set the global prompt as the system-wide / default agent prompt, then attach the matching overlay as the model’s system prompt or model description prefix.

| Profile | File | Model ID |
|---------|------|----------|
| Fast | `luna-fast.txt` | `openai/gpt-5.6-luna` (+ optional `:nitro`) |
| Smart (default) | `sol-smart.txt` | `openai/gpt-5.6-sol` |
| Max | `sol-pro-max.txt` | `openai/gpt-5.6-sol-pro` |
| Builder | `opus-builder.txt` | `anthropic/claude-opus-5` |
| Marathon | `fable-marathon.txt` | `anthropic/claude-fable-5.1` |
| Multimodal | `gemini-multimodal.txt` | `google/gemini-3.8-flash` |
| Second opinion | `grok-verify.txt` | `x-ai/grok-4.6` |
| Council synthesizer note | `council-synthesizer.txt` | Council pipe final stage |
