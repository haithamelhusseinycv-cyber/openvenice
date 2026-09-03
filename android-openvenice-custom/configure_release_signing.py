"""Inject environment-backed release signing into generated Android Gradle files."""
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("Usage: configure_release_signing.py <app/build.gradle|app/build.gradle.kts>")

path = Path(sys.argv[1])
if not path.is_file():
    raise RuntimeError(f"Android app Gradle file not found: {path}")

text = path.read_text(encoding="utf-8")
marker = "openVeniceRelease"
if marker in text:
    raise SystemExit(f"Release signing already configured in {path}")

android_marker = "android {"
index = text.find(android_marker)
if index < 0:
    raise RuntimeError(f"Could not locate android block in {path}")

if path.suffix == ".kts":
    insertion = """android {
    signingConfigs {
        create("openVeniceRelease") {
            val signingStore = System.getenv("OPENVENICE_RELEASE_KEYSTORE")
                ?: error("OPENVENICE_RELEASE_KEYSTORE is required")
            storeFile = file(signingStore)
            storePassword = System.getenv("OPENVENICE_RELEASE_STORE_PASSWORD")
                ?: error("OPENVENICE_RELEASE_STORE_PASSWORD is required")
            keyAlias = System.getenv("OPENVENICE_RELEASE_KEY_ALIAS")
                ?: error("OPENVENICE_RELEASE_KEY_ALIAS is required")
            keyPassword = System.getenv("OPENVENICE_RELEASE_KEY_PASSWORD")
                ?: error("OPENVENICE_RELEASE_KEY_PASSWORD is required")
        }
    }
"""
    binding = """

android.buildTypes.getByName("release").signingConfig =
    android.signingConfigs.getByName("openVeniceRelease")
"""
else:
    insertion = """android {
    signingConfigs {
        openVeniceRelease {
            def signingStore = System.getenv("OPENVENICE_RELEASE_KEYSTORE")
            if (!signingStore) throw new GradleException("OPENVENICE_RELEASE_KEYSTORE is required")
            storeFile file(signingStore)
            storePassword System.getenv("OPENVENICE_RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("OPENVENICE_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("OPENVENICE_RELEASE_KEY_PASSWORD")
        }
    }
"""
    binding = """

android.buildTypes.release.signingConfig = android.signingConfigs.openVeniceRelease
"""

text = text[:index] + insertion + text[index + len(android_marker):] + binding
path.write_text(text, encoding="utf-8")
print(f"Configured environment-backed release signing in {path}")
