# Progressive TTS Specification

Pipeline:
LLM stream → sentence boundary detect → TTS request → immediate playback → concurrent next-sentence synthesis → ordered queue.

Requirements:
- Start within a few seconds when provider/network allows.
- Do not wait for full response.
- No arbitrary truncation.
- Support stop/regenerate.
- Cancel stale queue on interruption or navigation.
- Prevent overlapping speech.
