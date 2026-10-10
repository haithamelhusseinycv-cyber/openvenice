from pathlib import Path
import re
root = Path("android-face-fusion")
custom = Path("android-face-fusion-custom")
java = root / "app/src/main/java/com/pv/androidfacefusion"
(java / "PwaBridgeServer.java").write_text((custom / "PwaBridgeServer.java").read_text())
manifest = root / "app/src/main/AndroidManifest.xml"
text = manifest.read_text()
for permission in ("android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_SPECIAL_USE"):
    if f'"{permission}"' not in text:
        text = text.replace("    <application", f'    <uses-permission android:name="{permission}" />\n    <application', 1)
marker = 'android:permission="ai.openvenice.permission.FACEFUSION_AGENT" />'
assert marker in text
text = text.replace(marker, '''android:permission="ai.openvenice.permission.FACEFUSION_AGENT"
            android:foregroundServiceType="specialUse">
            <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="On-device image processing for the installed Chilli PWA" />
        </service>''')
manifest.write_text(text)
activity = java / "MainActivity.java"
text = activity.read_text()
marker = "        setContentView(R.layout.activity_main);"
assert marker in text
text = text.replace(marker, marker + '''
        startForegroundService(new Intent(this, AgentBridgeService.class));''', 1)
activity.write_text(text)
gradle = root / "app/build.gradle.kts"
text = re.sub(r"versionCode = \d+", "versionCode = 47", gradle.read_text())
text = re.sub(r'versionName = "[^"]+"', 'versionName = "4.6.0"', text)
gradle.write_text(text)
print("FaceFusion PWA transport applied")
