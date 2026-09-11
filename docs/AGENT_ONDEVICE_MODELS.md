# Shahy on-device models

Local Dream and FaceFusion do **not** take model uploads into Shahy. Weights stay on the phone.

## Local Dream

Shahy talks to the Local Dream companion on localhost. Local Dream has **no HTTP download API**. A generation model must already exist in the Local Dream app.

1. Install Local Dream.
2. Open it and tap a built-in checkpoint (Anything V5, ChilloutMix, Absolute Reality, or an SDXL model if the chip supports it).
3. Wait until the download finishes.
4. Shahy can then `localdream.ensure_ready`, `localdream.select_model`, and generate.

Custom SD1.5 checkpoints can be imported in Local Dream (CPU/GPU). NPU SDXL packages must be the chip-tier zip for that phone. Shahy never copies those files.

`localdream.ensure_ready` reports whether a generation model is already present. If none are, it tells you to download inside Local Dream.

## FaceFusion

FaceFusion models are **not** inside the APK. Shahy can now download the minimum packs through the signature-protected companion (`facefusion.ensure_models`).

Minimum runtime:

- RetinaFace 10G (detector)
- ArcFace W600K R50 (recognition)
- 2DFAN4 (landmarks)
- INSwapper 128 FP16 (swapper; INSwapper 128 is an accepted fallback)

Optional quality packs (`includeOptional: true`):

- CodeFormer
- Real-ESRGAN x4 FP16

Downloads go to FaceFusion private storage. If the companion is an older build without protocol 2, open **Complete Models** and download those four packs there.

## Diagnostics

Device diagnostics warn when:

- Local Dream is up but has zero generation models
- FaceFusion is bound but has no swapper pack
