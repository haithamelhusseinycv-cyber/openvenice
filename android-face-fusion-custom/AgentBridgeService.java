package com.pv.androidfacefusion;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Signature-protected IPC bridge used by the OpenVenice Android agent.
 *
 * The bridge deliberately exposes a small command surface through Messenger
 * rather than exporting FaceFusion internals or relying on Accessibility UI
 * automation. Image inputs are content:// URIs; outputs are FileProvider URIs.
 */
public final class AgentBridgeService extends Service {
    private static final String TAG = "FaceFusionAgentBridge";
    public static final String PERMISSION = "ai.openvenice.permission.FACEFUSION_AGENT";

    public static final int MSG_LIST_MODELS = 1;
    public static final int MSG_DETECT_FACES = 2;
    public static final int MSG_SWAP = 3;
    public static final int MSG_ENHANCE = 4;
    public static final int MSG_CANCEL = 5;
    public static final int MSG_PING = 6;

    public static final String KEY_REQUEST_ID = "requestId";
    public static final String KEY_IMAGE_URI = "imageUri";
    public static final String KEY_SOURCE_URI = "sourceUri";
    public static final String KEY_TARGET_URI = "targetUri";
    public static final String KEY_TARGET_FACE_INDICES = "targetFaceIndices";
    public static final String KEY_SWAPPER = "swapper";
    public static final String KEY_FACE_ENHANCER = "faceEnhancer";
    public static final String KEY_FRAME_ENHANCER = "frameEnhancer";

    private static final String PREFS = "model_settings";
    private static final String DEFAULT_SWAPPER = "inswapper_128.onnx";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicInteger cancellationEpoch = new AtomicInteger(0);
    private final Object runtimeLock = new Object();

    private FaceDetector faceDetector;
    private FaceEmbedder faceEmbedder;
    private FaceSwapper faceSwapper;
    private String loadedSwapper;

    private final Messenger messenger = new Messenger(new IncomingHandler(Looper.getMainLooper()));

    @Override
    public IBinder onBind(Intent intent) {
        enforceCallingOrSelfPermission(PERMISSION, "OpenVenice FaceFusion agent permission required");
        return messenger.getBinder();
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        synchronized (runtimeLock) {
            if (faceSwapper != null) faceSwapper.close();
            if (faceEmbedder != null) faceEmbedder.close();
            if (faceDetector != null) faceDetector.close();
            faceSwapper = null;
            faceEmbedder = null;
            faceDetector = null;
        }
        super.onDestroy();
    }

    private final class IncomingHandler extends Handler {
        IncomingHandler(Looper looper) {
            super(looper);
        }

        @Override
        public void handleMessage(Message msg) {
            final Messenger replyTo = msg.replyTo;
            final Bundle request = msg.getData() != null ? new Bundle(msg.getData()) : new Bundle();
            final int callerUid = msg.sendingUid;
            final int command = msg.what;

            if (replyTo == null) return;

            if (command == MSG_CANCEL) {
                cancellationEpoch.incrementAndGet();
                replySuccess(replyTo, command, request, new JSONObject());
                return;
            }

            if (command == MSG_PING) {
                JSONObject payload = new JSONObject();
                try {
                    payload.put("service", "FaceFusion AgentBridgeService");
                    payload.put("protocol", 1);
                    payload.put("package", getPackageName());
                } catch (Exception ignored) {}
                replySuccess(replyTo, command, request, payload);
                return;
            }

            final int epoch = cancellationEpoch.get();
            executor.execute(() -> {
                try {
                    checkCancelled(epoch);
                    JSONObject result;
                    switch (command) {
                        case MSG_LIST_MODELS:
                            result = listModels();
                            break;
                        case MSG_DETECT_FACES:
                            result = detectFaces(requireString(request, KEY_IMAGE_URI), epoch);
                            break;
                        case MSG_SWAP:
                            result = runSwap(request, callerUid, epoch);
                            break;
                        case MSG_ENHANCE:
                            result = runEnhance(request, callerUid, epoch);
                            break;
                        default:
                            throw new IllegalArgumentException("Unknown FaceFusion agent command: " + command);
                    }
                    checkCancelled(epoch);
                    replySuccess(replyTo, command, request, result);
                } catch (Throwable error) {
                    Log.e(TAG, "Agent bridge command failed: " + command, error);
                    replyError(replyTo, command, request, error);
                }
            });
        }
    }

    private JSONObject listModels() throws Exception {
        JSONArray detectors = new JSONArray();
        JSONArray recognizers = new JSONArray();
        JSONArray landmarks = new JSONArray();
        JSONArray swappers = new JSONArray();
        JSONArray faceEnhancers = new JSONArray();
        JSONArray frameEnhancers = new JSONArray();

        for (ModelCatalog.ModelPack pack : ModelCatalog.all()) {
            if (!isPackDownloaded(pack)) continue;
            if ("Detection".equals(pack.category)) detectors.put(pack.id);
            else if ("Recognition".equals(pack.category)) recognizers.put(pack.id);
            else if ("Landmarks".equals(pack.category)) landmarks.put(pack.id);
            else if ("Face swapper".equals(pack.category) && isRuntimeSwapper(pack.id)) swappers.put(pack.id);
            else if ("Face enhancer".equals(pack.category) && isRuntimeFaceEnhancer(pack.id)) faceEnhancers.put(pack.id);
            else if ("Frame enhancer".equals(pack.category) && isRuntimeFrameEnhancer(pack.id)) frameEnhancers.put(pack.id);
        }

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject selected = new JSONObject();
        selected.put("swapper", prefs.getString("swapper_model", DEFAULT_SWAPPER));
        selected.put("faceEnhancer", prefs.getString("face_enhancer_model", "none"));
        selected.put("frameEnhancer", prefs.getString("frame_enhancer_model", "none"));

        JSONObject out = new JSONObject();
        out.put("detectors", detectors);
        out.put("recognizers", recognizers);
        out.put("landmarks", landmarks);
        out.put("swappers", swappers);
        out.put("faceEnhancers", faceEnhancers);
        out.put("frameEnhancers", frameEnhancers);
        out.put("selected", selected);
        return out;
    }

    private JSONObject detectFaces(String imageUri, int epoch) throws Exception {
        ensureAnalysisRuntime();
        Bitmap image = loadBitmap(imageUri);
        try {
            checkCancelled(epoch);
            List<FaceDetector.Face> faces = faceDetector.detectFaces(image);
            JSONArray items = new JSONArray();
            for (int i = 0; i < faces.size(); i++) {
                FaceDetector.Face face = faces.get(i);
                JSONObject item = new JSONObject();
                item.put("index", i);
                item.put("confidence", face.score);
                if (face.bbox != null) {
                    JSONObject bounds = new JSONObject();
                    bounds.put("left", face.bbox.left);
                    bounds.put("top", face.bbox.top);
                    bounds.put("right", face.bbox.right);
                    bounds.put("bottom", face.bbox.bottom);
                    item.put("bounds", bounds);
                }
                items.put(item);
            }
            JSONObject out = new JSONObject();
            out.put("faces", items);
            out.put("width", image.getWidth());
            out.put("height", image.getHeight());
            return out;
        } finally {
            image.recycle();
        }
    }

    private JSONObject runSwap(Bundle request, int callerUid, int epoch) throws Exception {
        String sourceUri = requireString(request, KEY_SOURCE_URI);
        String targetUri = requireString(request, KEY_TARGET_URI);

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String swapperFile = resolveModelFile(request.getString(KEY_SWAPPER), "Face swapper",
                prefs.getString("swapper_model", DEFAULT_SWAPPER));
        String faceEnhancerFile = resolveOptionalModelFile(request.getString(KEY_FACE_ENHANCER), "Face enhancer",
                prefs.getString("face_enhancer_model", "none"));
        String frameEnhancerFile = resolveOptionalModelFile(request.getString(KEY_FRAME_ENHANCER), "Frame enhancer",
                prefs.getString("frame_enhancer_model", "none"));

        prefs.edit()
                .putString("swapper_model", swapperFile)
                .putString("face_enhancer_model", faceEnhancerFile)
                .putString("frame_enhancer_model", frameEnhancerFile)
                .apply();

        ensureAnalysisRuntime();
        ensureSwapperRuntime(swapperFile);

        Bitmap source = loadBitmap(sourceUri);
        Bitmap target = loadBitmap(targetUri);
        Bitmap swapped = null;
        Bitmap finalImage = null;
        long started = System.currentTimeMillis();
        try {
            checkCancelled(epoch);
            FaceFusionProcessor processor = new FaceFusionProcessor(faceDetector, faceEmbedder, faceSwapper);
            int[] requestedIndices = request.getIntArray(KEY_TARGET_FACE_INDICES);
            if (requestedIndices != null && requestedIndices.length > 0) {
                Set<Integer> indices = new HashSet<>();
                for (int index : requestedIndices) if (index >= 0) indices.add(index);
                swapped = processor.processFaceFusion(source, target, indices);
            } else {
                swapped = processor.processFaceFusion(source, target, 0);
            }

            checkCancelled(epoch);
            EnhancementProcessor enhancer = new EnhancementProcessor(this, faceDetector);
            finalImage = enhancer.apply(swapped);
            checkCancelled(epoch);

            Uri outputUri = saveOutput(finalImage, callerUid, "swap");
            JSONObject metadata = new JSONObject();
            metadata.put("swapper", swapperFile);
            metadata.put("faceEnhancer", faceEnhancerFile);
            metadata.put("frameEnhancer", frameEnhancerFile);

            JSONObject out = new JSONObject();
            out.put("outputUri", outputUri.toString());
            out.put("elapsedMs", System.currentTimeMillis() - started);
            out.put("width", finalImage.getWidth());
            out.put("height", finalImage.getHeight());
            out.put("metadata", metadata);
            return out;
        } finally {
            source.recycle();
            target.recycle();
            if (finalImage != null && finalImage != swapped && !finalImage.isRecycled()) finalImage.recycle();
            if (swapped != null && !swapped.isRecycled()) swapped.recycle();
        }
    }

    private JSONObject runEnhance(Bundle request, int callerUid, int epoch) throws Exception {
        String imageUri = requireString(request, KEY_IMAGE_URI);
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String faceEnhancerFile = resolveOptionalModelFile(request.getString(KEY_FACE_ENHANCER), "Face enhancer",
                prefs.getString("face_enhancer_model", "none"));
        String frameEnhancerFile = resolveOptionalModelFile(request.getString(KEY_FRAME_ENHANCER), "Frame enhancer",
                prefs.getString("frame_enhancer_model", "none"));
        prefs.edit()
                .putString("face_enhancer_model", faceEnhancerFile)
                .putString("frame_enhancer_model", frameEnhancerFile)
                .apply();

        ensureAnalysisRuntime();
        Bitmap input = loadBitmap(imageUri);
        Bitmap output = null;
        long started = System.currentTimeMillis();
        try {
            checkCancelled(epoch);
            EnhancementProcessor enhancer = new EnhancementProcessor(this, faceDetector);
            output = enhancer.apply(input);
            checkCancelled(epoch);
            Uri outputUri = saveOutput(output, callerUid, "enhance");

            JSONObject metadata = new JSONObject();
            metadata.put("faceEnhancer", faceEnhancerFile);
            metadata.put("frameEnhancer", frameEnhancerFile);

            JSONObject out = new JSONObject();
            out.put("outputUri", outputUri.toString());
            out.put("elapsedMs", System.currentTimeMillis() - started);
            out.put("width", output.getWidth());
            out.put("height", output.getHeight());
            out.put("metadata", metadata);
            return out;
        } finally {
            if (output != null && output != input && !output.isRecycled()) output.recycle();
            if (!input.isRecycled()) input.recycle();
        }
    }

    private void ensureAnalysisRuntime() throws Exception {
        synchronized (runtimeLock) {
            if (faceDetector == null) {
                faceDetector = new FaceDetector(this);
                faceDetector.initialize();
            }
            if (faceEmbedder == null) {
                faceEmbedder = new FaceEmbedder(this);
                faceEmbedder.initialize();
            }
        }
    }

    private void ensureSwapperRuntime(String selectedFile) throws Exception {
        synchronized (runtimeLock) {
            if (faceSwapper != null && selectedFile.equals(loadedSwapper)) return;
            if (faceSwapper != null) faceSwapper.close();
            faceSwapper = new FaceSwapper(this);
            faceSwapper.initialize();
            loadedSwapper = faceSwapper.getSelectedModel();
            if (!selectedFile.equals(loadedSwapper)) {
                throw new IllegalStateException("Requested swapper could not be loaded: " + selectedFile);
            }
        }
    }

    private Bitmap loadBitmap(String uriValue) throws Exception {
        Uri uri = Uri.parse(uriValue);
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IllegalArgumentException("Could not open image URI: " + uriValue);
            Bitmap bitmap = BitmapFactory.decodeStream(input);
            if (bitmap == null) throw new IllegalArgumentException("Could not decode image URI: " + uriValue);
            if (bitmap.getConfig() == null) {
                Bitmap copy = bitmap.copy(Bitmap.Config.ARGB_8888, false);
                bitmap.recycle();
                bitmap = copy;
            }
            return bitmap;
        }
    }

    private Uri saveOutput(Bitmap bitmap, int callerUid, String prefix) throws Exception {
        File dir = new File(getCacheDir(), "shared_images");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create FaceFusion output directory");
        File out = new File(dir, "agent-" + prefix + "-" + System.currentTimeMillis() + ".jpg");
        try (FileOutputStream stream = new FileOutputStream(out)) {
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)) {
                throw new IllegalStateException("Could not encode FaceFusion output");
            }
        }
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", out);
        String[] packages = getPackageManager().getPackagesForUid(callerUid);
        if (packages != null) {
            for (String packageName : packages) {
                grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        }
        return uri;
    }

    private String resolveModelFile(String requested, String category, String fallbackFile) {
        if (requested == null || requested.trim().isEmpty()) return fallbackFile;
        String value = requested.trim();
        for (ModelCatalog.ModelPack pack : ModelCatalog.all()) {
            if (!category.equals(pack.category)) continue;
            if (pack.id.equals(value) || pack.name.equalsIgnoreCase(value)) {
                return pack.files.get(0).name;
            }
            for (ModelCatalog.ModelFile file : pack.files) {
                if (file.name.equals(value)) return pack.files.get(0).name;
            }
        }
        throw new IllegalArgumentException("Unknown " + category + " model: " + requested);
    }

    private String resolveOptionalModelFile(String requested, String category, String fallbackFile) {
        if (requested == null || requested.trim().isEmpty()) return fallbackFile;
        if ("none".equalsIgnoreCase(requested.trim())) return "none";
        return resolveModelFile(requested, category, fallbackFile);
    }

    private boolean isPackDownloaded(ModelCatalog.ModelPack pack) {
        if (pack.files.isEmpty()) return false;
        for (ModelCatalog.ModelFile file : pack.files) {
            File local = new File(getFilesDir(), file.name);
            if (!local.exists() || local.length() < 1024 * 1024L) return false;
        }
        return true;
    }

    private boolean isRuntimeSwapper(String id) {
        return id.startsWith("inswapper_128") || id.startsWith("ghost_") || id.startsWith("hyperswap_")
                || id.startsWith("simswap_") || "uniface_256".equals(id);
    }

    private boolean isRuntimeFaceEnhancer(String id) {
        return "codeformer".equals(id) || id.startsWith("gfpgan_") || id.startsWith("gpen_bfr_")
                || "restoreformer_plus_plus".equals(id);
    }

    private boolean isRuntimeFrameEnhancer(String id) {
        return id.startsWith("real_esrgan_x2") || id.startsWith("real_esrgan_x4")
                || "ultra_sharp_x4".equals(id) || "ultra_sharp_2_x4".equals(id);
    }

    private String requireString(Bundle data, String key) {
        String value = data.getString(key);
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException("Missing required field: " + key);
        return value;
    }

    private void checkCancelled(int epoch) {
        if (epoch != cancellationEpoch.get() || Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("FaceFusion agent job cancelled");
        }
    }

    private void replySuccess(Messenger replyTo, int command, Bundle request, JSONObject payload) {
        Bundle data = new Bundle();
        data.putBoolean("ok", true);
        data.putString(KEY_REQUEST_ID, request.getString(KEY_REQUEST_ID, ""));
        data.putString("json", payload.toString());
        sendReply(replyTo, command, data);
    }

    private void replyError(Messenger replyTo, int command, Bundle request, Throwable error) {
        Bundle data = new Bundle();
        data.putBoolean("ok", false);
        data.putString(KEY_REQUEST_ID, request.getString(KEY_REQUEST_ID, ""));
        data.putString("error", error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName());
        sendReply(replyTo, command, data);
    }

    private void sendReply(Messenger replyTo, int command, Bundle data) {
        Message response = Message.obtain(null, command);
        response.setData(data);
        try {
            replyTo.send(response);
        } catch (RemoteException error) {
            Log.w(TAG, "Agent caller disconnected before reply", error);
        }
    }
}
