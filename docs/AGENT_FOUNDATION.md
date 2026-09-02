# OpenVenice Agent Foundation

This branch introduces the first implementation layer for turning OpenVenice into an Android-first Qwen agent rather than a Venice-only chat client.

## Responsibilities

- **Qwen**: planning, reasoning, vision review, prompt/settings selection, and tool choice.
- **Local Dream**: on-device text-to-image, img2img, inpaint, and local enhancement through its existing localhost API.
- **FaceFusion**: on-device face detection, identity swap, face restoration, and frame enhancement through a future signature-protected Android bridge.

## Tool model

Agent capabilities are described by `AgentTool` records and registered in `AgentToolRegistry`. Each tool declares:

- stable tool id
- human/model description
- JSON-like input schema
- required permissions
- risk classification (`read`, `write`, `destructive`)
- executor

The registry intentionally does not silently substitute one tool/provider for another. The requested tool remains explicit.

## Local Dream connector

`src/connectors/localdream/localdream-connector.ts` targets the current Local Dream host protocol:

- control: `127.0.0.1:8808`
- generation: `127.0.0.1:8081`
- `/info`
- `/models`
- `/select`
- `/status`
- `/stop`
- `/generate` SSE

The HTTP transport is abstracted so the current browser `fetch` implementation can later be replaced with a Capacitor/native Android transport. This matters because HTTPS browser builds can encounter CORS/mixed-content restrictions when talking to localhost HTTP.

## FaceFusion connector

The existing custom FaceFusion code is native Android code, so this foundation defines the transport-neutral bridge contract first. The Android build will provide an implementation backed by a signature-protected service/content-URI bridge rather than UI tap automation.

## Next implementation stages

1. Qwen OpenAI-compatible provider and provider router.
2. Wire Qwen into the existing chat stream while retaining Venice as a selectable provider.
3. Android/Capacitor shell and native localhost transport.
4. Local Dream tool execution from chat.
5. FaceFusion Android AgentBridgeService and OpenVenice bridge implementation.
6. Agent planner/tool-calling loop.
7. Plugin/MCP discovery, permissions, updates, and rollback.
8. Job queue, result review, and multi-tool pipelines.
