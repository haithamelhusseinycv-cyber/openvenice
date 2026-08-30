from pathlib import Path

root = Path('android-face-fusion')
java_dir = root / 'app/src/main/java/com/pv/androidfacefusion'
build_gradle = root / 'app/build.gradle.kts'

# 1) Use FaceFusion's direct GitHub Release assets for every Complete Models pack.
# Hugging Face currently serves these large files through Xet; a plain Android
# HttpURLConnection can occasionally save a bad response as if it were the model.
catalog_path = java_dir / 'ModelCatalog.java'
catalog = catalog_path.read_text(encoding='utf-8')
old_url = 'return "https://huggingface.co/facefusion/models-" + version + "/resolve/main/" + file;'
new_url = 'return "https://github.com/facefusion/facefusion-assets/releases/download/models-" + version + "/" + file;'
if old_url not in catalog and new_url not in catalog:
    raise RuntimeError('Could not locate ModelCatalog download URL helper')
catalog = catalog.replace(old_url, new_url)
catalog_path.write_text(catalog, encoding='utf-8')

# 2) Make the built-in INSwapper recovery downloader prefer the same direct
# FaceFusion release asset, while retaining the old mirrors as fallbacks.
downloader_path = java_dir / 'ModelDownloader.java'
downloader = downloader_path.read_text(encoding='utf-8')
old_swap_urls = '''    private static final List<String> SWAP_MODEL_URLS = Arrays.asList(\n        "https://huggingface.co/leonelhs/insightface/resolve/main/inswapper_128.onnx",\n        "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx"\n    );'''
new_swap_urls = '''    private static final List<String> SWAP_MODEL_URLS = Arrays.asList(\n        "https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/inswapper_128.onnx",\n        "https://huggingface.co/leonelhs/insightface/resolve/main/inswapper_128.onnx",\n        "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx"\n    );'''
if old_swap_urls in downloader:
    downloader = downloader.replace(old_swap_urls, new_swap_urls)
elif 'facefusion-assets/releases/download/models-3.0.0/inswapper_128.onnx' not in downloader:
    raise RuntimeError('Could not patch built-in INSwapper URL list')
downloader_path.write_text(downloader, encoding='utf-8')

# 3) Validate completed catalog downloads against the server-reported size.
# This catches truncated/resume-corrupted large files before the UI marks them downloaded.
activity_path = java_dir / 'ModelCatalogActivity.java'
activity = activity_path.read_text(encoding='utf-8')
small_check = '                if (out.length() < 1024 * 1024L) throw new Exception("Downloaded file is unexpectedly small");'
robust_check = '''                if (total > 0 && out.length() != total) {\n                    long actual = out.length();\n                    out.delete();\n                    throw new Exception("Incomplete download: expected " + total + " bytes, got " + actual);\n                }\n                if (out.length() < 1024 * 1024L) {\n                    out.delete();\n                    throw new Exception("Downloaded file is unexpectedly small");\n                }'''
if small_check in activity:
    activity = activity.replace(small_check, robust_check)
elif 'Incomplete download: expected' not in activity:
    raise RuntimeError('Could not patch Complete Models download validation')
activity = activity.replace('AndroidFaceFusion/CompleteModelsV3', 'AndroidFaceFusion/CompleteModelsV31')
activity_path.write_text(activity, encoding='utf-8')

# 4) If ONNX Runtime rejects the selected swapper, remove the bad file and
# recover to a clean INSwapper 128 from the direct release asset. This also
# repairs phones that already have a corrupt v3 model cached.
swapper_path = java_dir / 'FaceSwapper.java'
swapper = swapper_path.read_text(encoding='utf-8')
old_open = '        session = OrtSessionHelper.createSession(env, model.getAbsolutePath(), TAG);'
recovery_open = '''        try {\n            session = OrtSessionHelper.createSession(env, model.getAbsolutePath(), TAG);\n        } catch (Exception badModel) {\n            Log.e(TAG, "Selected swapper model is invalid; recovering with INSwapper 128", badModel);\n            if (model != null && model.exists()) model.delete();\n            if (converterSession != null) {\n                try { converterSession.close(); } catch (Exception ignored) {}\n                converterSession = null;\n            }\n\n            spec = specFor("inswapper_128.onnx");\n            prefs.edit().putString("swapper_model", spec.file).apply();\n            File fallback = new File(context.getFilesDir(), spec.file);\n\n            // A large cached file can still be corrupt. Try parsing it first.\n            if (valid(fallback)) {\n                try {\n                    session = OrtSessionHelper.createSession(env, fallback.getAbsolutePath(), TAG + "Recovery");\n                } catch (Exception badFallback) {\n                    Log.w(TAG, "Cached fallback is also invalid; forcing a clean download", badFallback);\n                    fallback.delete();\n                }\n            }\n\n            if (session == null) {\n                fallback = new ModelDownloader(context).getModelFile(spec.file);\n                try {\n                    session = OrtSessionHelper.createSession(env, fallback.getAbsolutePath(), TAG + "Recovery");\n                } catch (Exception badDownload) {\n                    if (fallback.exists()) fallback.delete();\n                    throw new Exception("Fresh INSwapper download is invalid; please retry on a stable connection.", badDownload);\n                }\n            }\n        }'''
if old_open in swapper:
    swapper = swapper.replace(old_open, recovery_open, 1)
elif 'Selected swapper model is invalid; recovering with INSwapper 128' not in swapper:
    raise RuntimeError('Could not patch FaceSwapper recovery')
swapper_path.write_text(swapper, encoding='utf-8')

# 5) v3.1 update identity. Same package + debug signing key, so Android updates in place.
gradle = build_gradle.read_text(encoding='utf-8')
gradle = gradle.replace('versionCode = 3', 'versionCode = 31')
gradle = gradle.replace('versionName = "3.0"', 'versionName = "3.1"')
build_gradle.write_text(gradle, encoding='utf-8')

print('Complete Models v3.1 downloader/recovery patch applied successfully.')
