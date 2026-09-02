import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: pin_debug_signing.py <app/build.gradle>')

path = Path(sys.argv[1])
if not path.is_file():
    raise RuntimeError(f'Android app Gradle file not found: {path}')

text = path.read_text(encoding='utf-8')
marker = 'openVeniceStableDebug'

if marker not in text:
    android_marker = 'android {'
    index = text.find(android_marker)
    if index < 0:
        raise RuntimeError(f'Could not locate android block in {path}')

    insertion = '''android {\n    // OpenVenice/FaceFusion companion builds must share one persistent\n    // certificate. Do not let Gradle create a fresh debug key per CI run.\n    signingConfigs {\n        openVeniceStableDebug {\n            def configuredStore = System.getenv("OPENVENICE_DEBUG_KEYSTORE")\n            storeFile file(configuredStore ?: new File(System.getProperty("user.home"), ".android/debug.keystore"))\n            storePassword "android"\n            keyAlias "androiddebugkey"\n            keyPassword "android"\n        }\n    }\n'''
    text = text[:index] + insertion + text[index + len(android_marker):]
    text += '''\n\n// Explicitly bind the debug variant to the shared certificate. This is kept\n// outside the generated buildTypes block so it works across Capacitor and the\n// FaceFusion upstream Gradle layouts.\nandroid.buildTypes.debug.signingConfig = android.signingConfigs.openVeniceStableDebug\n'''

path.write_text(text, encoding='utf-8')
print(f'Pinned debug signing configuration in {path}')
