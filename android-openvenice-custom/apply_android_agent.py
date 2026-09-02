from pathlib import Path

root = Path('android')
app = root / 'app'
main_java = app / 'src/main/java/ai/openvenice/app'
res_xml = app / 'src/main/res/xml'
manifest = app / 'src/main/AndroidManifest.xml'
custom = Path('android-openvenice-custom')

if not root.exists():
    raise RuntimeError('Capacitor Android project was not generated before applying OpenVenice native customization')

main_java.mkdir(parents=True, exist_ok=True)
res_xml.mkdir(parents=True, exist_ok=True)

for source in ('FaceFusionAgentPlugin.java', 'MediaActionsPlugin.java', 'VoiceChatPlugin.java'):
    (main_java / source).write_text(
        (custom / source).read_text(encoding='utf-8'),
        encoding='utf-8',
    )

# Explicit plugin registration keeps the native surface deterministic and makes
# it easy to verify in CI. Loopback mixed content is needed only because Local
# Dream exposes its generation service over localhost HTTP.
(main_java / 'MainActivity.java').write_text('''package ai.openvenice.app;\n\nimport android.os.Bundle;\nimport android.webkit.WebSettings;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(FaceFusionAgentPlugin.class);\n        registerPlugin(MediaActionsPlugin.class);\n        registerPlugin(VoiceChatPlugin.class);\n        super.onCreate(savedInstanceState);\n        if (getBridge() != null && getBridge().getWebView() != null) {\n            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);\n        }\n    }\n}\n''', encoding='utf-8')

# FileProvider stays limited to app-private cache/files. It is used for temporary
# agent inputs and Android share intents; generated files are never exposed as
# arbitrary filesystem paths.
(res_xml / 'file_paths.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <cache-path name="agent_cache" path="." />\n    <files-path name="agent_files" path="." />\n</paths>\n''', encoding='utf-8')

(res_xml / 'network_security_config.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n    <base-config cleartextTrafficPermitted="false" />\n    <domain-config cleartextTrafficPermitted="true">\n        <domain includeSubdomains="false">127.0.0.1</domain>\n        <domain includeSubdomains="false">localhost</domain>\n    </domain-config>\n</network-security-config>\n''', encoding='utf-8')

text = manifest.read_text(encoding='utf-8')

permissions = [
    '    <uses-permission android:name="ai.openvenice.permission.FACEFUSION_AGENT" />\n',
    '    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n',
    '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />\n',
]
for permission in permissions:
    name = permission.split('android:name="', 1)[1].split('"', 1)[0]
    if name not in text:
        marker = '<application'
        index = text.find(marker)
        if index < 0:
            raise RuntimeError('Could not locate AndroidManifest application element')
        text = text[:index] + permission + '\n' + text[index:]

queries = '''    <queries>\n        <package android:name="com.pv.androidfacefusion" />\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>\n\n'''
if '<action android:name="android.speech.RecognitionService"' not in text:
    marker = '<application'
    index = text.find(marker)
    if index < 0:
        raise RuntimeError('Could not locate AndroidManifest application element for package visibility')
    text = text[:index] + queries + text[index:]

if 'android:networkSecurityConfig=' not in text:
    text = text.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"', 1)

provider = '''\n        <provider\n            android:name="androidx.core.content.FileProvider"\n            android:authorities="${applicationId}.fileprovider"\n            android:exported="false"\n            android:grantUriPermissions="true">\n            <meta-data\n                android:name="android.support.FILE_PROVIDER_PATHS"\n                android:resource="@xml/file_paths" />\n        </provider>\n'''
if '${applicationId}.fileprovider' not in text:
    marker = '</application>'
    index = text.find(marker)
    if index < 0:
        raise RuntimeError('Could not locate AndroidManifest application closing element')
    text = text[:index] + provider + text[index:]

manifest.write_text(text, encoding='utf-8')

print('OpenVenice Android agent shell customization applied successfully.')
