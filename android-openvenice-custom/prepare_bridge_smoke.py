"""Prepare release-signed instrumentation for the actual cross-app IPC boundary."""
from pathlib import Path
import re
gradle = Path("android/app/build.gradle")
text = gradle.read_text()
text = text.replace("android {", 'android {\n    testBuildType "release"', 1)
text, count = re.subn(r'testInstrumentationRunner\s+"[^"]+"',
                     'testInstrumentationRunner "ai.openvenice.app.FaceFusionBridgeSmoke"', text)
if count != 1:
    raise RuntimeError("Expected exactly one instrumentation runner")
gradle.write_text(text)
target = Path("android/app/src/androidTest/java/ai/openvenice/app")
target.mkdir(parents=True, exist_ok=True)
(target / "FaceFusionBridgeSmoke.java").write_text(
    Path("android-openvenice-custom/FaceFusionBridgeSmoke.java").read_text())
print("Prepared release-signed OpenVenice companion bridge smoke")
