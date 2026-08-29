from pathlib import Path

root = Path('android-face-fusion')
java_dir = root / 'app/src/main/java/com/pv/androidfacefusion'
manifest = root / 'app/src/main/AndroidManifest.xml'
main_activity = java_dir / 'MainActivity.java'
image_utils = java_dir / 'ImageUtils.java'
face_embedder = java_dir / 'FaceEmbedder.java'
build_gradle = root / 'app/build.gradle.kts'
custom = Path('android-face-fusion-custom')

# v3 runtime classes.
(java_dir / 'ModelCatalog.java').write_text((custom / 'ModelCatalog.java').read_text(), encoding='utf-8')
(java_dir / 'ModelCatalogActivity.java').write_text((custom / 'ModelCatalogActivityV3.java').read_text(), encoding='utf-8')
(java_dir / 'EnhancementProcessor.java').write_text((custom / 'EnhancementProcessorV3.java').read_text(), encoding='utf-8')
(java_dir / 'FaceSwapper.java').write_text((custom / 'FaceSwapperV3.java').read_text(), encoding='utf-8')
(java_dir / 'FaceFusionProcessor.java').write_text((custom / 'FaceFusionProcessorV3.java').read_text(), encoding='utf-8')

# Update catalog descriptions displayed in v3.
catalog_path = java_dir / 'ModelCatalog.java'
catalog = catalog_path.read_text(encoding='utf-8')
for old, new in {
    'Catalog/download pack; requires Ghost-specific Android processor.': 'Supported by the Complete Models v3 Ghost runtime.',
    'Catalog/download pack; requires HyperSwap-specific Android processor.': 'Supported by the Complete Models v3 HyperSwap runtime.',
    'Catalog/download pack; requires SimSwap-specific Android processor.': 'Supported by the Complete Models v3 SimSwap runtime.',
    'Catalog/download pack; requires UniFace-specific Android processor.': 'Supported by Complete Models v3 in Standard Swap mode.',
    'Fully supported by this Android build.': 'Supported by the Complete Models v3 Android runtime.',
    'Fully supported alternate; smaller model and recommended for mobile.': 'Supported mobile-friendly FP16 INSwapper runtime.'
}.items():
    catalog = catalog.replace(old, new)
catalog_path.write_text(catalog, encoding='utf-8')

# Register Complete Models activity.
text = manifest.read_text(encoding='utf-8')
marker = '''        <activity\n            android:name=".ImagePreviewActivity"'''
insert = '''        <activity\n            android:name=".ModelCatalogActivity"\n            android:screenOrientation="portrait" />\n\n'''
if '.ModelCatalogActivity' not in text:
    text = text.replace(marker, insert + marker)
manifest.write_text(text, encoding='utf-8')

# Add Complete Models v3 button to the title card.
text = main_activity.read_text(encoding='utf-8')
call_marker = '        setContentView(R.layout.activity_main);\n'
if 'installModelsButton();' not in text:
    text = text.replace(call_marker, call_marker + '        installModelsButton();\n')
method_marker = '    private void initViews() {\n'
method = '''    private void installModelsButton() {\n        MaterialCardView titleCard = findViewById(R.id.titleCard);\n        if (titleCard == null || titleCard.getChildCount() == 0 ||\n                !(titleCard.getChildAt(0) instanceof LinearLayout)) return;\n        LinearLayout content = (LinearLayout) titleCard.getChildAt(0);\n        MaterialButton modelsButton = new MaterialButton(this);\n        modelsButton.setText("Complete Models v3");\n        modelsButton.setAllCaps(false);\n        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.MATCH_PARENT,\n                LinearLayout.LayoutParams.WRAP_CONTENT);\n        int margin = Math.round(8 * getResources().getDisplayMetrics().density);\n        params.setMargins(0, margin, 0, 0);\n        content.addView(modelsButton, params);\n        modelsButton.setOnClickListener(v ->\n                startActivity(new Intent(this, ModelCatalogActivity.class)));\n    }\n\n'''
if 'private void installModelsButton()' not in text:
    text = text.replace(method_marker, method + method_marker)

# Apply selected post-processing after standard and Face Library swaps.
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
    raise RuntimeError('Could not locate Face Library result block')
main_activity.write_text(text, encoding='utf-8')

# Expose the raw ArcFace embedding. v3 needs raw identity vectors for Ghost/SimSwap
# while the existing getEmbedding() remains normalized for the Face Library.
text = face_embedder.read_text(encoding='utf-8')
raw_method = '''    public float[] getRawEmbedding(Bitmap faceBitmap) throws OrtException {\n        if (session == null) throw new IllegalStateException("Model not initialized");\n        Bitmap resizedFace = Bitmap.createScaledBitmap(faceBitmap, INPUT_SIZE, INPUT_SIZE, true);\n        float[] inputData = bitmapToFloatArray(resizedFace);\n        long[] shape = {1, 3, INPUT_SIZE, INPUT_SIZE};\n        OnnxTensor inputTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(inputData), shape);\n        String inputName = session.getInputNames().iterator().next();\n        OrtSession.Result results = session.run(java.util.Collections.singletonMap(inputName, inputTensor));\n        float[][] embedding = (float[][]) results.get(0).getValue();\n        float[] raw = embedding[0].clone();\n        inputTensor.close();\n        results.close();\n        if (resizedFace != faceBitmap) resizedFace.recycle();\n        return raw;\n    }\n\n'''
embed_marker = '    public float[] getEmbedding(Bitmap faceBitmap) throws OrtException {\n'
if 'getRawEmbedding(Bitmap faceBitmap)' not in text:
    if embed_marker not in text:
        raise RuntimeError('Could not locate FaceEmbedder.getEmbedding')
    text = text.replace(embed_marker, raw_method + embed_marker)
face_embedder.write_text(text, encoding='utf-8')

# Add FaceFusion's normalized landmark templates and model-aware alignment helpers.
text = image_utils.read_text(encoding='utf-8')
helper_marker = '''    /**\n     * Align face based on landmarks using similarity transformation\n'''
template_helpers = '''    private static final float[][] V3_ARCFACE_112_V1 = {\n        {0.35473214f, 0.45658929f}, {0.64526786f, 0.45658929f},\n        {0.50000000f, 0.61154464f}, {0.37913393f, 0.77687500f},\n        {0.62086607f, 0.77687500f}\n    };\n    private static final float[][] V3_ARCFACE_128 = {\n        {0.36167656f, 0.40387734f}, {0.63696719f, 0.40235469f},\n        {0.50019687f, 0.56044219f}, {0.38710391f, 0.72160547f},\n        {0.61507734f, 0.72034453f}\n    };\n    private static final float[][] V3_FFHQ_512 = {\n        {0.37691676f, 0.46864664f}, {0.62285697f, 0.46912813f},\n        {0.50123859f, 0.61331904f}, {0.39308822f, 0.72541100f},\n        {0.61150205f, 0.72490465f}\n    };\n\n    private static float[][] v3Template(String name, int size) {\n        float[][] normalized;\n        if ("arcface_112_v1".equals(name)) normalized = V3_ARCFACE_112_V1;\n        else if ("ffhq_512".equals(name)) normalized = V3_FFHQ_512;\n        else normalized = V3_ARCFACE_128;\n        float[][] out = new float[5][2];\n        for (int i = 0; i < 5; i++) {\n            out[i][0] = normalized[i][0] * size;\n            out[i][1] = normalized[i][1] * size;\n        }\n        return out;\n    }\n\n    public static Bitmap alignFaceTemplate(Bitmap image, float[] landmarks, String template, int targetSize) {\n        if (landmarks == null || landmarks.length < 10)\n            return Bitmap.createScaledBitmap(image, targetSize, targetSize, true);\n        float[][] src = new float[5][2];\n        for (int i = 0; i < 5; i++) {\n            src[i][0] = landmarks[i * 2];\n            src[i][1] = landmarks[i * 2 + 1];\n        }\n        Matrix m = estimateSimilarityTransform(src, v3Template(template, targetSize));\n        Bitmap aligned = Bitmap.createBitmap(targetSize, targetSize, Bitmap.Config.ARGB_8888);\n        Canvas canvas = new Canvas(aligned);\n        canvas.drawBitmap(image, m, new Paint(Paint.FILTER_BITMAP_FLAG));\n        return aligned;\n    }\n\n    public static Bitmap blendFacesTemplate(Bitmap targetImage, Bitmap swappedFace, float[] landmarks,\n                                            String template, int faceSize) {\n        try {\n            float[][] src = new float[5][2];\n            for (int i = 0; i < 5; i++) {\n                src[i][0] = landmarks[i * 2];\n                src[i][1] = landmarks[i * 2 + 1];\n            }\n            Matrix transform = estimateSimilarityTransform(src, v3Template(template, faceSize));\n            Matrix inverse = new Matrix();\n            if (transform.invert(inverse))\n                return advancedBlend(targetImage, swappedFace, inverse, faceSize);\n            return simpleBlend(targetImage, swappedFace, landmarks);\n        } catch (Exception e) {\n            android.util.Log.e("ImageUtils", "v3 template blend failed", e);\n            return simpleBlend(targetImage, swappedFace, landmarks);\n        }\n    }\n\n'''
if 'alignFaceTemplate(Bitmap image' not in text:
    if helper_marker not in text:
        raise RuntimeError('Could not locate ImageUtils alignment section')
    text = text.replace(helper_marker, template_helpers + helper_marker)
image_utils.write_text(text, encoding='utf-8')

# Version 3 keeps the same package/signing identity, so Android can update v2 in place.
text = build_gradle.read_text(encoding='utf-8')
text = text.replace('versionCode = 1', 'versionCode = 3')
text = text.replace('versionName = "1.0"', 'versionName = "3.0"')
build_gradle.write_text(text, encoding='utf-8')

print('Complete Models v3 multi-swapper customization applied successfully.')
