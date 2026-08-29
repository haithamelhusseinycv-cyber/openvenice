from pathlib import Path

root = Path('android-face-fusion')
java_dir = root / 'app/src/main/java/com/pv/androidfacefusion'
manifest = root / 'app/src/main/AndroidManifest.xml'
main_activity = java_dir / 'MainActivity.java'
swapper = java_dir / 'FaceSwapper.java'

# Copy custom Java sources prepared in the build-host repository.
custom = Path('android-face-fusion-custom')
(java_dir / 'ModelCatalog.java').write_text((custom / 'ModelCatalog.java').read_text(), encoding='utf-8')
(java_dir / 'ModelCatalogActivity.java').write_text((custom / 'ModelCatalogActivity.java').read_text(), encoding='utf-8')

# Register model manager activity.
text = manifest.read_text(encoding='utf-8')
marker = '''        <activity\n            android:name=".ImagePreviewActivity"'''
insert = '''        <activity\n            android:name=".ModelCatalogActivity"\n            android:screenOrientation="portrait" />\n\n'''
if '.ModelCatalogActivity' not in text:
    text = text.replace(marker, insert + marker)
manifest.write_text(text, encoding='utf-8')

# Add a Complete Models button to the title card without changing XML resources.
text = main_activity.read_text(encoding='utf-8')
call_marker = '        setContentView(R.layout.activity_main);\n'
if 'installModelsButton();' not in text:
    text = text.replace(call_marker, call_marker + '        installModelsButton();\n')

method_marker = '    private void initViews() {\n'
method = '''    private void installModelsButton() {\n        MaterialCardView titleCard = findViewById(R.id.titleCard);\n        if (titleCard == null || titleCard.getChildCount() == 0 ||\n                !(titleCard.getChildAt(0) instanceof LinearLayout)) {\n            return;\n        }\n        LinearLayout content = (LinearLayout) titleCard.getChildAt(0);\n        MaterialButton modelsButton = new MaterialButton(this);\n        modelsButton.setText("Complete Models");\n        modelsButton.setAllCaps(false);\n        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.MATCH_PARENT,\n                LinearLayout.LayoutParams.WRAP_CONTENT);\n        int margin = Math.round(8 * getResources().getDisplayMetrics().density);\n        params.setMargins(0, margin, 0, 0);\n        content.addView(modelsButton, params);\n        modelsButton.setOnClickListener(v ->\n                startActivity(new Intent(this, ModelCatalogActivity.class)));\n    }\n\n'''
if 'private void installModelsButton()' not in text:
    text = text.replace(method_marker, method + method_marker)
main_activity.write_text(text, encoding='utf-8')

# Make the INSwapper implementation selectable between full precision and FP16.
text = swapper.read_text(encoding='utf-8')
old = '''            ModelDownloader downloader = new ModelDownloader(context);\n            File modelFile = downloader.getModelFile("inswapper_128.onnx");\n'''
new = '''            ModelDownloader downloader = new ModelDownloader(context);\n            android.content.SharedPreferences prefs = context.getSharedPreferences(\n                    "model_settings", Context.MODE_PRIVATE);\n            String selectedModel = prefs.getString("swapper_model", "inswapper_128.onnx");\n            if (!"inswapper_128.onnx".equals(selectedModel) &&\n                    !"inswapper_128_fp16.onnx".equals(selectedModel)) {\n                selectedModel = "inswapper_128.onnx";\n            }\n            File modelFile = new File(context.getFilesDir(), selectedModel);\n            if (!modelFile.exists() || modelFile.length() < 1024 * 1024L) {\n                if ("inswapper_128.onnx".equals(selectedModel)) {\n                    modelFile = downloader.getModelFile("inswapper_128.onnx");\n                } else {\n                    Log.w(TAG, "Selected FP16 swapper is not downloaded; falling back to INSwapper 128");\n                    selectedModel = "inswapper_128.onnx";\n                    prefs.edit().putString("swapper_model", selectedModel).apply();\n                    modelFile = downloader.getModelFile("inswapper_128.onnx");\n                }\n            }\n            Log.d(TAG, "Selected face swapper model: " + selectedModel);\n'''
if old in text:
    text = text.replace(old, new)
elif 'Selected face swapper model:' not in text:
    raise RuntimeError('Could not locate FaceSwapper model loading block')
swapper.write_text(text, encoding='utf-8')

print('Complete-models customization applied successfully.')
