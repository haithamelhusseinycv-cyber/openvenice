from pathlib import Path

root = Path('android-face-fusion')
java_dir = root / 'app/src/main/java/com/pv/androidfacefusion'
manifest = root / 'app/src/main/AndroidManifest.xml'
main_activity = java_dir / 'MainActivity.java'
swapper = java_dir / 'FaceSwapper.java'
image_utils = java_dir / 'ImageUtils.java'
build_gradle = root / 'app/build.gradle.kts'

# Copy custom Java sources prepared in the build-host repository.
custom = Path('android-face-fusion-custom')
(java_dir / 'ModelCatalog.java').write_text((custom / 'ModelCatalog.java').read_text(), encoding='utf-8')
(java_dir / 'ModelCatalogActivity.java').write_text((custom / 'ModelCatalogActivityV2.java').read_text(), encoding='utf-8')
(java_dir / 'EnhancementProcessor.java').write_text((custom / 'EnhancementProcessor.java').read_text(), encoding='utf-8')

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
method = '''    private void installModelsButton() {\n        MaterialCardView titleCard = findViewById(R.id.titleCard);\n        if (titleCard == null || titleCard.getChildCount() == 0 ||\n                !(titleCard.getChildAt(0) instanceof LinearLayout)) {\n            return;\n        }\n        LinearLayout content = (LinearLayout) titleCard.getChildAt(0);\n        MaterialButton modelsButton = new MaterialButton(this);\n        modelsButton.setText("Complete Models v2");\n        modelsButton.setAllCaps(false);\n        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.MATCH_PARENT,\n                LinearLayout.LayoutParams.WRAP_CONTENT);\n        int margin = Math.round(8 * getResources().getDisplayMetrics().density);\n        params.setMargins(0, margin, 0, 0);\n        content.addView(modelsButton, params);\n        modelsButton.setOnClickListener(v ->\n                startActivity(new Intent(this, ModelCatalogActivity.class)));\n    }\n\n'''
if 'private void installModelsButton()' not in text:
    text = text.replace(method_marker, method + method_marker)

# Apply selected post-processing after both standard and library swaps.
old_standard = '''                Bitmap result = processor.processFaceFusion(sourceBitmap, targetBitmap, selectedFaceIndices);\n                resultBitmap = result;\n'''
new_standard = '''                Bitmap swapResult = processor.processFaceFusion(sourceBitmap, targetBitmap, selectedFaceIndices);\n                runOnUiThread(() -> updateOverlay("Applying selected enhancements...", -1));\n                EnhancementProcessor enhancementProcessor = new EnhancementProcessor(this, faceDetector);\n                Bitmap result = enhancementProcessor.apply(swapResult);\n                if (result != swapResult) swapResult.recycle();\n                resultBitmap = result;\n'''
if old_standard in text:
    text = text.replace(old_standard, new_standard)
elif 'EnhancementProcessor enhancementProcessor' not in text:
    raise RuntimeError('Could not locate standard face-fusion result block')

old_library = '''                Bitmap result = processor.processFaceFusionWithMapping(libraryTargetBitmap, embeddingMap);\n                resultBitmap = result;\n'''
new_library = '''                Bitmap swapResult = processor.processFaceFusionWithMapping(libraryTargetBitmap, embeddingMap);\n                runOnUiThread(() -> updateOverlay("Applying selected enhancements...", -1));\n                EnhancementProcessor enhancementProcessor = new EnhancementProcessor(this, faceDetector);\n                Bitmap result = enhancementProcessor.apply(swapResult);\n                if (result != swapResult) swapResult.recycle();\n                resultBitmap = result;\n'''
if old_library in text:
    text = text.replace(old_library, new_library)
elif text.count('EnhancementProcessor enhancementProcessor') < 2:
    raise RuntimeError('Could not locate library face-fusion result block')
main_activity.write_text(text, encoding='utf-8')

# Add the FaceFusion FFHQ-512 alignment template used by CodeFormer/GFPGAN.
text = image_utils.read_text(encoding='utf-8')
array_marker = '''    private static final float[][] FFHQ_SRC_128 = {\n        {38.2946f + 8.0f, 51.6963f},  // left eye\n        {73.5318f + 8.0f, 51.5014f},  // right eye\n        {56.0252f + 8.0f, 71.7366f},  // nose\n        {41.5493f + 8.0f, 92.3655f},  // left mouth\n        {70.7299f + 8.0f, 92.2041f}   // right mouth\n    };\n'''
ffhq_512 = '''\n    // FaceFusion ffhq_512 normalized landmark template multiplied by 512.\n    private static final float[][] FFHQ_SRC_512 = {\n        {192.98138f, 239.94708f},\n        {318.90277f, 240.19360f},\n        {256.63416f, 314.01935f},\n        {201.26117f, 371.41043f},\n        {313.08905f, 371.15118f}\n    };\n'''
if 'FFHQ_SRC_512' not in text:
    if array_marker not in text:
        raise RuntimeError('Could not locate FFHQ_SRC_128 array')
    text = text.replace(array_marker, array_marker + ffhq_512)

text = text.replace(
    'float[][] refLandmarks = (targetSize == 112) ? ARCFACE_SRC : FFHQ_SRC_128;',
    'float[][] refLandmarks = (targetSize == 112) ? ARCFACE_SRC : ((targetSize == 512) ? FFHQ_SRC_512 : FFHQ_SRC_128);'
)
text = text.replace(
    'float[][] refLandmarks = (faceSize == 112) ? ARCFACE_SRC : FFHQ_SRC_128;',
    'float[][] refLandmarks = (faceSize == 112) ? ARCFACE_SRC : ((faceSize == 512) ? FFHQ_SRC_512 : FFHQ_SRC_128);'
)
image_utils.write_text(text, encoding='utf-8')

# Make INSwapper selectable between full precision and FP16.
text = swapper.read_text(encoding='utf-8')
old = '''            ModelDownloader downloader = new ModelDownloader(context);\n            File modelFile = downloader.getModelFile("inswapper_128.onnx");\n'''
new = '''            ModelDownloader downloader = new ModelDownloader(context);\n            android.content.SharedPreferences prefs = context.getSharedPreferences(\n                    "model_settings", Context.MODE_PRIVATE);\n            String selectedModel = prefs.getString("swapper_model", "inswapper_128.onnx");\n            if (!"inswapper_128.onnx".equals(selectedModel) &&\n                    !"inswapper_128_fp16.onnx".equals(selectedModel)) {\n                selectedModel = "inswapper_128.onnx";\n            }\n            File modelFile = new File(context.getFilesDir(), selectedModel);\n            if (!modelFile.exists() || modelFile.length() < 1024 * 1024L) {\n                if ("inswapper_128.onnx".equals(selectedModel)) {\n                    modelFile = downloader.getModelFile("inswapper_128.onnx");\n                } else {\n                    Log.w(TAG, "Selected FP16 swapper is not downloaded; falling back to INSwapper 128");\n                    selectedModel = "inswapper_128.onnx";\n                    prefs.edit().putString("swapper_model", selectedModel).apply();\n                    modelFile = downloader.getModelFile("inswapper_128.onnx");\n                }\n            }\n            Log.d(TAG, "Selected face swapper model: " + selectedModel);\n'''
if old in text:
    text = text.replace(old, new)
elif 'Selected face swapper model:' not in text:
    raise RuntimeError('Could not locate FaceSwapper model loading block')
swapper.write_text(text, encoding='utf-8')

# Identify this build in Android app metadata.
text = build_gradle.read_text(encoding='utf-8')
text = text.replace('versionName = "1.0"', 'versionName = "2.0"')
build_gradle.write_text(text, encoding='utf-8')

print('Complete Models v2 enhancement customization applied successfully.')
