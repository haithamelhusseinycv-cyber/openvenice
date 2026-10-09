# Chilli 1.0.2 release verification
Version 1.0.2, Android version code 3. Package com.chili.app.
Signed with the dedicated Chilli RSA-4096 release certificate.
Certificate SHA-256: 199e28a4ffacfae81ebcbcd21e09691751cf2f77fe79b951bf043722c88734f2.
APK SHA-256: cea7771bedf1d0c6086c6196eeb44e1eb99035ceab81dae93a8f0c5e2c3a0a54.

## Repairs
Corrected Generate preset argument order and Outfit routing identifier.
Smart Create forwards photo bytes, invalidates stale previews, and supports photo-only editing.
Swaps use Venice multi-image editing with all selected identity references.
Synchronous provider results are parsed correctly; paid POSTs do not auto-retry.
Cloud requests honor cancellation and deadlines, retain reconnect tokens, and acknowledge only after local persistence.
Images persist as durable bytes on web and private files on Android; gallery reload restores results and library opens originals.
Feature search opens the selected feature. Prompt versions and session settings are saved on generation.
Offline queue processing is connected and serialized; failed and interrupted work is retained for explicit recovery.
Unicode recipes use portable production URLs.
Registered secure credential, media, voice, and optional FaceFusion plugins.
Cleartext access is limited to the device's local gateway. Application backup and debugging are disabled.

## Verified
TypeScript: passed. Vite production build: passed.
Unit tests: 166 passed across 30 files.
ESLint: zero errors, 22 nonfatal warnings.
Android assembleRelease and release lint: passed. R8 minification and resource shrinking enabled.
APK signature and zip alignment: passed. APK is not debuggable; WebView debugging disabled.
Installed on OnePlus 13 / Android 16 as an in-place update preserving application data.
Packaged web assets match the verified production dist exactly.
12 controlled browser checks passed: chat, Generate, full viewer/download, tools navigation/upload, edit, tools download, upscale/background removal, swap guards/dual mapping, Outfit mapping, remove source, reload restoration.
Production web shell and entry JS/CSS return HTTP 200.

## Scope and remaining dependency
Controlled provider responses validate request handling and UI behavior, not live inference quality.
Native vault encryption, read/clear, MediaStore save/read, and speech-service availability are tested with a signed instrumentation APK without enabling application debugging.
The existing FaceFusion companion does not trust the dedicated Chilli certificate; its original signing key was not found on the phone.
Its signature permission remains enforced. Visible image swaps use Venice instead.
The independent FaceFusion IPC path is unavailable until the companion publisher adds Chilli's certificate in a signed companion update.
Microphone recognition, acoustic speech playback, live paid inference, and cloud GPU output quality are not certified by these checks.
Spaceship remained signed out after its secure sign-in submission failed.

## Reproduction
Run TypeScript, Vite, Vitest, and ESLint from the repository.
Serve dist on port 5174, then run tests/chilli-release.mjs with Playwright and Chromium.
Sync Capacitor before assembling the release. Sign with the external release keystore and existing signing lineage.
Signing keys/passwords, API credentials, personal media, local SDK paths, and native test APKs are excluded from this repository and release.
