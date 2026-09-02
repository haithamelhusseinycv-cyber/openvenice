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

# Install the native Capacitor plugin.
(main_java / 'FaceFusionAgentPlugin.java').write_text(
    (custom / 'FaceFusionAgentPlugin.java').read_text(encoding='utf-8'),
    encoding='utf-8',
)

# Replace the minimal generated MainActivity with explicit plugin registration
# and loopback mixed-content support. General cleartext remains blocked by the
# network security config; only localhost is permitted.
(main_java / 'MainActivity.java').write_text('''package ai.openvenice.app;\n\nimport android.os.Bundle;\nimport android.webkit.WebSettings;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(FaceFusionAgentPlugin.class);\n        super.onCreate(savedInstanceState);\n        if (getBridge() != null && getBridge().getWebView() != null) {\n            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);\n        }\n    }\n}\n''', encoding='utf-8')

# Keep the FileProvider surface limited to app-private files/cache while allowing
# the native bridge to expose temporary agent images by content:// URI.
(res_xml / 'file_paths.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <cache-path name="agent_cache" path="." />\n    <files-path name="agent_files" path="." />\n</paths>\n''', encoding='utf-8')

(res_xml / 'network_security_config.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n    <base-config cleartextTrafficPermitted="false" />\n    <domain-config cleartextTrafficPermitted="true">\n        <domain includeSubdomains="false">127.0.0.1</domain>\n        <domain includeSubdomains="false">localhost</domain>\n    </domain-config>\n</network-security-config>\n''', encoding='utf-8')

text = manifest.read_text(encoding='utf-8')

permission = '    <uses-permission android:name="ai.openvenice.permission.FACEFUSION_AGENT" />\n'
if 'ai.openvenice.permission.FACEFUSION_AGENT' not in text:
    marker = '<application'
    index = text.find(marker)
    if index < 0:
        raise RuntimeError('Could not locate AndroidManifest application element')
    text = text[:index] + permission + '\n' + text[index:]

queries = '''    <queries>\n        <package android:name="com.pv.androidfacefusion" />\n    </queries>\n\n'''
if 'com.pv.androidfacefusion' not in text:
    marker = '<application'
    index = text.find(marker)
    if index < 0:
        raise RuntimeError('Could not locate AndroidManifest application element for package visibility')
    text = text[:index] + queries + text[index:]

if 'android:networkSecurityConfig=' not in text:
    text = text.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"', 1)

manifest.write_text(text, encoding='utf-8')

print('OpenVenice Android agent shell customization applied successfully.')
