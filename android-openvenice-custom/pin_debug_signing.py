import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: pin_debug_signing.py <app/build.gradle|app/build.gradle.kts>')

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

    if path.suffix == '.kts':
        insertion = '''android {\n    // OpenVenice/FaceFusion companion builds must share one persistent\n    // certificate. Do not let Gradle create a fresh debug key per CI run.\n    signingConfigs {\n        create("openVeniceStableDebug") {\n            val configuredStore = System.getenv("OPENVENICE_DEBUG_KEYSTORE")\n            storeFile = file(configuredStore ?: java.io.File(System.getProperty("user.home"), ".android/debug.keystore"))\n            storePassword = "android"\n            keyAlias = "androiddebugkey"\n            keyPassword = "android"\n        }\n    }\n'''
        binding = '''\n\n// Explicitly bind the debug variant to the shared certificate.\nandroid.buildTypes.getByName("debug").signingConfig = android.signingConfigs.getByName("openVeniceStableDebug")\n'''
    else:
        insertion = '''android {\n    // OpenVenice/FaceFusion companion builds must share one persistent\n    // certificate. Do not let Gradle create a fresh debug key per CI run.\n    signingConfigs {\n        openVeniceStableDebug {\n            def configuredStore = System.getenv("OPENVENICE_DEBUG_KEYSTORE")\n            storeFile file(configuredStore ?: new File(System.getProperty("user.home"), ".android/debug.keystore"))\n            storePassword "android"\n            keyAlias "androiddebugkey"\n            keyPassword "android"\n        }\n    }\n'''
        binding = '''\n\n// Explicitly bind the debug variant to the shared certificate.\nandroid.buildTypes.debug.signingConfig = android.signingConfigs.openVeniceStableDebug\n'''

    text = text[:index] + insertion + text[index + len(android_marker):] + binding

path.write_text(text, encoding='utf-8')
print(f'Pinned debug signing configuration in {path}')
