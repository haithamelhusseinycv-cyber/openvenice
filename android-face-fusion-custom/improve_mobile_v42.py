from pathlib import Path
import re
root = Path("android-face-fusion")
java = root / "app/src/main/java/com/pv/androidfacefusion"
def replace(text, old, new):
    if old not in text:
        raise RuntimeError("Patch anchor missing: " + old[:100])
    return text.replace(old, new)
p = java / "ModelCatalogActivity.java"
s = p.read_text()
s = replace(s, '    private TextView summary;', '''    private TextView summary;
    private String query = "";
    private boolean downloadedOnly;
    private boolean downloading;
    private final java.util.Set<View> actionButtons = new java.util.HashSet<>();
''')
s = s.replace('setTitle("Complete Models v3")', 'setTitle("Models")')
s = s.replace('Face Fusion — Complete Models v3', 'Choose your models')
a = s.index('        note.setText(')
b = s.index('\n', a)
s = s[:a] + '        note.setText("Choose one swap model. Face restoration and upscaling are optional. Start with your installed models; larger models need more memory.");' + s[b:]
s = replace(s, '        ScrollView scroll = new ScrollView(this);', '''        android.widget.EditText search = new android.widget.EditText(this);
        search.setSingleLine(true);
        search.setHint("Search models or categories");
        search.setContentDescription("Search models");
        root.addView(search, new LinearLayout.LayoutParams(-1, -2));
        android.widget.CheckBox installed = new android.widget.CheckBox(this);
        installed.setText("Show downloaded models only");
        root.addView(installed);
        installed.setOnCheckedChangeListener((button, checked) -> {
            downloadedOnly = checked;
            if (!downloading) rebuildList();
        });
        search.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence t, int start, int count, int after) {}
            public void onTextChanged(CharSequence t, int start, int before, int count) {
                query = t.toString().trim().toLowerCase(java.util.Locale.ROOT);
                if (!downloading) rebuildList();
            }
            public void afterTextChanged(android.text.Editable t) {}
        });
        MaterialButton back = new MaterialButton(this);
        back.setText("Back to swap");
        back.setMinHeight(dp(48));
        back.setOnClickListener(v -> finish());
        root.addView(back);
        ScrollView scroll = new ScrollView(this);''')
s = replace(s, '        setContentView(root);', '''        setContentView(root);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(
                androidx.core.view.WindowInsetsCompat.Type.systemBars());
            v.setPadding(dp(12) + bars.left, dp(12) + bars.top,
                         dp(12) + bars.right, dp(12) + bars.bottom);
            return insets;
        });''')
s = replace(s, '        for (ModelCatalog.ModelPack pack : packs) list.addView(createPackCard(pack));', '''        actionButtons.clear();
        int visible = 0;
        for (ModelCatalog.ModelPack pack : packs) {
            if (downloadedOnly && !isDownloaded(pack)) continue;
            String searchable = (pack.name + " " + pack.category).toLowerCase(java.util.Locale.ROOT);
            if (!searchable.contains(query)) continue;
            list.addView(createPackCard(pack));
            visible++;
        }
        if (visible == 0) {
            TextView empty = new TextView(this);
            empty.setText("No matching models. Try another search or turn off the downloaded filter.");
            empty.setPadding(dp(12), dp(24), dp(12), dp(24));
            list.addView(empty);
        }''')
s = s.replace('buttons.setOrientation(LinearLayout.HORIZONTAL)', 'buttons.setOrientation(LinearLayout.VERTICAL)')
s = s.replace('new LinearLayout.LayoutParams(0, -2, 1f)', 'new LinearLayout.LayoutParams(-1, -2)')
s = replace(s, '        download.setOnClickListener', '''        for (int i = 0; i < buttons.getChildCount(); i++) {
            View button = buttons.getChildAt(i);
            button.setMinimumHeight(dp(48));
            actionButtons.add(button);
        }
        download.setOnClickListener''')
s = s.replace('pack.name + " selected. Fully close and reopen Face Fusion to reload the swap engine."',
              'pack.name + " selected. Return to the swap screen to load it."')
s = replace(s, '        remove.setOnClickListener(v -> removePack(pack));', '''        remove.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Remove " + pack.name + "?")
                .setMessage("This removes model files from this phone. Your images are kept. Files needed by another downloaded pack are kept.")
                .setNegativeButton("Keep", null)
                .setPositiveButton("Remove", (dialog, which) -> removePack(pack)).show());''')
s = replace(s, '            if (local.exists()) local.delete();', '''            boolean shared = false;
            for (ModelCatalog.ModelPack other : ModelCatalog.all()) {
                if (other.id.equals(pack.id) || !isDownloaded(other)) continue;
                for (ModelCatalog.ModelFile dependency : other.files)
                    if (dependency.name.equals(f.name)) shared = true;
            }
            if (!shared && local.exists() && !local.delete()) {
                Toast.makeText(this, "Could not remove " + f.name, Toast.LENGTH_LONG).show();
            }''')
s = replace(s, '        download.setEnabled(false);\n        remove.setEnabled(false);', '''        if (downloading) return;
        downloading = true;
        for (View button : actionButtons) button.setEnabled(false);''')
s = replace(s, '                    Toast.makeText(this, pack.name + " downloaded"', '''                    downloading = false;
                    if (isFinishing() || isDestroyed()) return;
                    Toast.makeText(this, pack.name + " downloaded"''')
s = replace(s, '                    progress.setVisibility(View.GONE);\n                    download.setEnabled(true);', '''                    downloading = false;
                    if (isFinishing() || isDestroyed()) return;
                    rebuildList();''')
s = replace(s, '        File out = new File(getFilesDir(), model.name);', '''        File destination = new File(getFilesDir(), model.name);
        File out = new File(getFilesDir(), model.name + ".part");''')
s = replace(s, '        for (int attempt = 0; attempt < 5; attempt++) {\n            try {', '''        for (int attempt = 0; attempt < 5; attempt++) {
            if (Thread.currentThread().isInterrupted()) throw new java.io.InterruptedIOException("Download stopped");
            try {''')
s = replace(s, '                boolean partial = code == 206;', '''                boolean partial = code == 206;
                if (partial) {
                    String range = conn.getHeaderField("Content-Range");
                    if (range == null || !range.startsWith("bytes " + existing + "-")) {
                        conn.disconnect();
                        out.delete();
                        throw new java.io.IOException("Server returned an invalid resume range");
                    }
                }''')
s = replace(s, '                        fos.write(buf, 0, n);', '''                        if (Thread.currentThread().isInterrupted())
                            throw new java.io.InterruptedIOException("Download stopped");
                        fos.write(buf, 0, n);''')
s = replace(s, '                return;\n            } catch (Exception e) {', '''                if (!out.renameTo(destination))
                    throw new java.io.IOException("Could not finish the model download");
                return;
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) throw e;''')
s = s.replace('AndroidFaceFusion/CompleteModelsV31', 'AndroidFaceFusion/Mobile42')
p.write_text(s)

p = java / "MainActivity.java"
s = p.read_text()
s = s.replace('modelsButton.setText("Complete Models v3")', 'modelsButton.setText("Models and quality")')
s = replace(s, '        setupListeners();', '        setupListeners();\n        installMobileActions();')
marker = '    private void initViews() {'
extra = '''
    private boolean mobileReloadFailed;

    private void installMobileActions() {
        android.view.ViewGroup resultParent = (android.view.ViewGroup) resultImageView.getParent();
        MaterialButton fullscreen = new MaterialButton(this);
        fullscreen.setText("View full screen");
        fullscreen.setMinHeight(Math.round(52 * getResources().getDisplayMetrics().density));
        fullscreen.setOnClickListener(v -> openImagePreview(resultBitmap));
        resultParent.addView(fullscreen, resultParent.indexOfChild(resultImageView) + 1);
        resultImageView.setContentDescription("Generated result. Tap to view full screen.");
        sourceImageView.setContentDescription("Source face. Tap to view full screen.");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if ((!mobileReloadFailed && processor == null) || faceSwapper == null || executorService == null) return;
        String requested = getSharedPreferences("model_settings", MODE_PRIVATE)
                .getString("swapper_model", "inswapper_128.onnx");
        if (!mobileReloadFailed && requested.equals(faceSwapper.getSelectedModel())) return;
        btnProcess.setEnabled(false);
        btnLibraryProcess.setEnabled(false);
        showOverlay("Loading selected model", "Please wait...");
        executorService.execute(() -> {
            try {
                mobileReloadFailed = true;
                faceSwapper.close();
                faceSwapper = new FaceSwapper(this);
                faceSwapper.initialize();
                processor = new FaceFusionProcessor(faceDetector, faceEmbedder, faceSwapper);
                mobileReloadFailed = false;
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    hideOverlay();
                    btnProcess.setEnabled(true);
                    btnLibraryProcess.setEnabled(true);
                });
            } catch (Exception e) {
                processor = null;
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    hideOverlay();
                    showError("Could not load selected model: " + e.getMessage());
                });
            }
        });
    }

'''
s = replace(s, marker, extra + marker)
# Report actual output dimensions on both completion paths.
s = s.replace('resultImageView.setImageBitmap(result);', '''resultImageView.setImageBitmap(result);
                    btnSaveResult.setText("Save " + result.getWidth() + " × " + result.getHeight());''')
# Never report success for a failed bitmap encoder or null MediaStore insertion.
s = replace(s, '                    resultBitmap.compress(Bitmap.CompressFormat.JPEG, 95, out);\n                    out.close();', '''                    try (OutputStream stream = out) {
                        if (stream == null || !resultBitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream))
                            throw new java.io.IOException("Image could not be written");
                    } catch (Exception writeError) {
                        getContentResolver().delete(uri, null, null);
                        throw writeError;
                    }''')
s = replace(s, '                    );\n                }\n            } catch (Exception e) {\n                e.printStackTrace();\n                runOnUiThread(() -> showError("Failed to save image:',
'''                    );
                } else {
                    throw new java.io.IOException("Gallery did not create an output file");
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showError("Failed to save image:''')
s = s.replace('"face_fusion_share.jpg"', '"face_fusion_share_" + System.currentTimeMillis() + ".jpg"')
p.write_text(s)

p = root / "app/src/main/res/layout/activity_main.xml"
s = p.read_text().replace('Source Face (Face to extract)', '1. Choose the face to use')
s = s.replace('Target Image (Face to replace)', '2. Choose the photo to change')
s = s.replace('android:text="Swap Faces"', 'android:text="3. Swap faces"')
s = s.replace('android:text="Local Image"', 'android:text="Choose photo"')
s = s.replace('Swap faces between images using AI', 'Choose a face, choose a photo, then swap')
p.write_text(s)
p = root / "app/build.gradle.kts"
s = re.sub(r'versionCode = \d+', 'versionCode = 42', p.read_text())
s = re.sub(r'versionName = "[^"]+"', 'versionName = "4.2"', s)
p.write_text(s)

p = java / "MainActivity.java"
s = p.read_text()
s = replace(s, "    private void showError(String message) {", """    private void safeRunOnUiThread(Runnable action) {
        if (isFinishing() || isDestroyed()) return;
        super.runOnUiThread(() -> {
            if (!isFinishing() && !isDestroyed()) action.run();
        });
    }

    private void showError(String message) {
        if (isFinishing() || isDestroyed()) return;""")
s = s.replace("runOnUiThread(", "safeRunOnUiThread(")
s = s.replace("super.safeRunOnUiThread(", "super.runOnUiThread(")
s = replace(s, """        executorService.shutdown();

        if (faceDetector != null) faceDetector.close();
        if (faceEmbedder != null) faceEmbedder.close();
        if (faceSwapper != null) faceSwapper.close();

        if (sourceBitmap != null) sourceBitmap.recycle();
        if (targetBitmap != null) targetBitmap.recycle();
        if (libraryTargetBitmap != null) libraryTargetBitmap.recycle();
        if (resultBitmap != null) resultBitmap.recycle();""", """        Runnable release = () -> {
            if (faceDetector != null) faceDetector.close();
            if (faceEmbedder != null) faceEmbedder.close();
            if (faceSwapper != null) faceSwapper.close();
            if (sourceBitmap != null && !sourceBitmap.isRecycled()) sourceBitmap.recycle();
            if (targetBitmap != null && !targetBitmap.isRecycled()) targetBitmap.recycle();
            if (libraryTargetBitmap != null && !libraryTargetBitmap.isRecycled()) libraryTargetBitmap.recycle();
            if (resultBitmap != null && !resultBitmap.isRecycled()) resultBitmap.recycle();
        };
        if (executorService == null) {
            release.run();
        } else {
            executorService.execute(release);
            executorService.shutdown();
        }""")
s = replace(s, """                resultBitmap.compress(Bitmap.CompressFormat.JPEG, 95, out);
                out.close();""", """                try (OutputStream stream = out) {
                    if (!resultBitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream))
                        throw new java.io.IOException("Image could not be prepared for sharing");
                }""")
p.write_text(s)
p = root / "app/build.gradle.kts"
s = re.sub(r'versionCode = \d+', 'versionCode = 44', p.read_text())
s = re.sub(r'versionName = "[^"]+"', 'versionName = "4.4"', s)
p.write_text(s)

print("FaceFusion mobile usability and download fixes applied")
