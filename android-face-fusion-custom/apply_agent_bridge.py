from pathlib import Path

root = Path('android-face-fusion')
java_dir = root / 'app/src/main/java/com/pv/androidfacefusion'
manifest = root / 'app/src/main/AndroidManifest.xml'
build_gradle = root / 'app/build.gradle.kts'
custom = Path('android-face-fusion-custom')

# Install the signature-protected Messenger service implementation.
(java_dir / 'AgentBridgeService.java').write_text(
    (custom / 'AgentBridgeService.java').read_text(encoding='utf-8'),
    encoding='utf-8',
)

# Define a signature permission and protect the exported bridge with it. Only
# an APK signed with the same certificate (the OpenVenice Android shell) can
# bind to this service.
text = manifest.read_text(encoding='utf-8')
permission = '''\n    <permission\n        android:name="ai.openvenice.permission.FACEFUSION_AGENT"\n        android:protectionLevel="signature|knownSigner"
        android:knownCerts="@array/openvenice_known_certs" />\n'''
if 'ai.openvenice.permission.FACEFUSION_AGENT' not in text:
    marker = '    <application\n'
    if marker not in text:
        raise RuntimeError('Could not locate AndroidManifest <application>')
    text = text.replace(marker, permission + '\n' + marker, 1)

service = '''\n        <service\n            android:name=".AgentBridgeService"\n            android:exported="true"\n            android:permission="ai.openvenice.permission.FACEFUSION_AGENT" />\n'''
if '.AgentBridgeService' not in text:
    marker = '        <provider\n'
    if marker not in text:
        raise RuntimeError('Could not locate FileProvider in AndroidManifest')
    text = text.replace(marker, service + '\n' + marker, 1)
# Explicitly trust the production OpenVenice certificate while preserving
# signature permission enforcement and the installed FaceFusion identity.
values = root / 'app/src/main/res/values'
values.mkdir(parents=True, exist_ok=True)
(values / 'openvenice_known_certs.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string-array name="openvenice_known_certs">\n        <item>2411BB5A182814F12798350EA77D5D922B27BDEF9076D4F0E0C1D02CF8090B48</item>\n    </string-array>\n</resources>\n', encoding='utf-8')
manifest.write_text(text, encoding='utf-8')

# Bridge release follows Complete Models v3 and keeps the package/signing
# identity so it can update the user's installed FaceFusion build in place.
gradle = build_gradle.read_text(encoding='utf-8')
gradle = gradle.replace('versionCode = 3', 'versionCode = 4')
gradle = gradle.replace('versionName = "3.0"', 'versionName = "4.0"')
build_gradle.write_text(gradle, encoding='utf-8')

print('FaceFusion AgentBridgeService customization applied successfully.')
