package com.chili.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.graphics.BitmapFactory;

@CapacitorPlugin(name = "FaceFusionAgent")
public final class FaceFusionAgentPlugin extends Plugin {
    private static final String FACEFUSION_PACKAGE = "com.pv.androidfacefusion";
    private static final String FACEFUSION_SERVICE = "com.pv.androidfacefusion.AgentBridgeService";

    private static final int MSG_LIST_MODELS = 1;
    private static final int MSG_DETECT_FACES = 2;
    private static final int MSG_SWAP = 3;
    private static final int MSG_ENHANCE = 4;
    private static final int MSG_CANCEL = 5;
    private static final int MSG_PING = 6;

    private final Object lock = new Object();
    private final Map<String, PluginCall> pending = new HashMap<>();
    private final List<Runnable> waitingForConnection = new ArrayList<>();

    private static final long MAX_BYTES = 16L * 1024 * 1024;
    private static final long MAX_PIXELS = 8_000_000;
    private final Handler deadlines = new Handler(Looper.getMainLooper());
    private final ExecutorService imageWorker = Executors.newSingleThreadExecutor();
    private long controlTimeoutMs = 10_000;
    private long jobTimeoutMs = 180_000;
    private final Map<String, Runnable> timers = new HashMap<>();
    private final Map<PluginCall, List<Uri>> grants = new HashMap<>();
    private final Map<PluginCall, List<File>> inputs = new HashMap<>();
    private final ThreadLocal<PluginCall> preparing = new ThreadLocal<>();
    private PluginCall activeImage;
    private volatile boolean destroyed;
    private final Runnable bindTimeout = () -> closeLostConnection("FaceFusion connection timed out.");

    private Messenger serviceMessenger;
    private boolean binding;
    private boolean bound;

    private final Messenger replyMessenger = new Messenger(new Handler(Looper.getMainLooper(), this::handleReply));

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            deadlines.removeCallbacks(bindTimeout);
            List<Runnable> queued;
            synchronized (lock) {
                serviceMessenger = new Messenger(service);
                binding = false;
                bound = true;
                queued = new ArrayList<>(waitingForConnection);
                waitingForConnection.clear();
            }
            for (Runnable runnable : queued) runnable.run();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            closeLostConnection("FaceFusion stopped. Retry the interrupted operation.");
        }

        @Override
        public void onBindingDied(ComponentName name) {
            onServiceDisconnected(name);
        }

        @Override
        public void onNullBinding(ComponentName name) {
            closeLostConnection("FaceFusion agent service returned a null binding.");
        }
    };

    @Override
    public void load() {
        imageWorker.execute(() -> {
            File dir = new File(getContext().getCacheDir(), "agent_inputs");
            File[] files = dir.listFiles();
            if (files != null) for (File file : files) {
                try {
                    Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                    getContext().revokeUriPermission(FACEFUSION_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (IllegalArgumentException ignored) {}
                file.delete();
            }
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", resolveService() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void ping(PluginCall call) {
        sendCommand(call, MSG_PING, new Bundle());
    }

    @PluginMethod
    public void listModels(PluginCall call) {
        sendCommand(call, MSG_LIST_MODELS, new Bundle());
    }

    @PluginMethod
    public void detectFaces(PluginCall call) {
        synchronized (lock) {
            if (activeImage != null) { call.reject("FaceFusion is busy. Wait for the active image operation."); return; }
            activeImage = call;
        }
        imageWorker.execute(() -> {
            preparing.set(call);
            try { 
        String input = call.getString("imageUri");
        if (input == null || input.trim().isEmpty()) {
            rejectPrepared(call, "imageUri is required");
            return;
        }
        try {
            Uri imageUri = prepareInputUri(input, "detect");
            Bundle data = new Bundle();
            data.putString("imageUri", imageUri.toString());
            sendCommand(call, MSG_DETECT_FACES, data);
        } catch (Exception error) {
            rejectPrepared(call, error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion image");
        }
    
            } finally { preparing.remove(); }
        });
    }

    @PluginMethod
    public void swap(PluginCall call) {
        synchronized (lock) {
            if (activeImage != null) { call.reject("FaceFusion is busy. Wait for the active image operation."); return; }
            activeImage = call;
        }
        imageWorker.execute(() -> {
            preparing.set(call);
            try { 
        String source = call.getString("sourceUri");
        String target = call.getString("targetUri");
        if (source == null || target == null) {
            rejectPrepared(call, "sourceUri and targetUri are required");
            return;
        }

        try {
            Bundle data = new Bundle();
            data.putString("sourceUri", prepareInputUri(source, "source").toString());
            data.putString("targetUri", prepareInputUri(target, "target").toString());
            putOptionalString(data, "swapper", call.getString("swapper"));
            putOptionalString(data, "faceEnhancer", call.getString("faceEnhancer"));
            putOptionalString(data, "frameEnhancer", call.getString("frameEnhancer"));

            JSArray indices = call.getArray("targetFaceIndices");
            if (indices != null) {
                JSONArray raw = indices;
                int[] values = new int[raw.length()];
                for (int i = 0; i < raw.length(); i++) values[i] = raw.optInt(i, -1);
                data.putIntArray("targetFaceIndices", values);
            }
            sendCommand(call, MSG_SWAP, data);
        } catch (Exception error) {
            rejectPrepared(call, error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion swap");
        }
    
            } finally { preparing.remove(); }
        });
    }

    @PluginMethod
    public void enhance(PluginCall call) {
        synchronized (lock) {
            if (activeImage != null) { call.reject("FaceFusion is busy. Wait for the active image operation."); return; }
            activeImage = call;
        }
        imageWorker.execute(() -> {
            preparing.set(call);
            try { 
        String input = call.getString("imageUri");
        if (input == null || input.trim().isEmpty()) {
            rejectPrepared(call, "imageUri is required");
            return;
        }
        try {
            Bundle data = new Bundle();
            data.putString("imageUri", prepareInputUri(input, "enhance").toString());
            putOptionalString(data, "faceEnhancer", call.getString("faceEnhancer"));
            putOptionalString(data, "frameEnhancer", call.getString("frameEnhancer"));
            sendCommand(call, MSG_ENHANCE, data);
        } catch (Exception error) {
            rejectPrepared(call, error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion enhancement");
        }
    
            } finally { preparing.remove(); }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        sendCancellation();
        List<String> ids;
        synchronized (lock) { ids = new ArrayList<>(pending.keySet()); }
        for (String id : ids) rejectPending(id, "FaceFusion operation cancelled.");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        closeLostConnection("FaceFusion agent bridge closed");
        imageWorker.shutdownNow();
        super.handleOnDestroy();
    }

    private void sendCommand(PluginCall call, int command, Bundle data) {
        if (destroyed) { rejectPrepared(call, "FaceFusion bridge is closed."); return; }
        final String requestId = UUID.randomUUID().toString();
        data.putString("requestId", requestId);
        synchronized (lock) {
            pending.put(requestId, call);
            Runnable timeout = () -> {
                if (command >= MSG_DETECT_FACES && command <= MSG_ENHANCE) {
                    sendCancellation();
                    // Clear connection state before waking the rejected caller;
                    // its next request must not race a delayed disconnect.
                    closeLostConnection("FaceFusion image operation timed out. Retry the interrupted operation.");
                } else {
                    synchronized (lock) {
                        if (pending.size() == 1 && pending.containsKey(requestId))
                            closeLostConnection("FaceFusion control request timed out.");
                        else rejectPending(requestId, "FaceFusion control request timed out.");
                    }
                }
            };
            timers.put(requestId, timeout);
            deadlines.postDelayed(timeout, command >= MSG_DETECT_FACES && command <= MSG_ENHANCE ? jobTimeoutMs : controlTimeoutMs);
        }

        withConnection(call, () -> {
            synchronized (lock) { if (!pending.containsKey(requestId)) return; }
            Messenger remote;
            synchronized (lock) {
                remote = serviceMessenger;
            }
            if (remote == null) {
                rejectPending(requestId, "FaceFusion agent service is unavailable");
                return;
            }
            Message message = Message.obtain(null, command);
            message.replyTo = replyMessenger;
            message.setData(data);
            try {
                remote.send(message);
            } catch (RemoteException error) {
                rejectPending(requestId, "Could not send command to FaceFusion: " + error.getMessage());
            }
        });
    }

    private void withConnection(PluginCall call, Runnable action) {
        synchronized (lock) {
            if (serviceMessenger != null && bound) {
                action.run();
                return;
            }
            waitingForConnection.add(action);
            if (binding) return;
            binding = true;
            deadlines.postDelayed(bindTimeout, controlTimeoutMs);
        }

        if (resolveService() == null) {
            failConnectionQueue("FaceFusion AgentBridgeService is not installed. Install the Chilli FaceFusion companion APK (same release channel as this app).");
            return;
        }

        Intent intent = new Intent();
        intent.setComponent(new ComponentName(FACEFUSION_PACKAGE, FACEFUSION_SERVICE));
        try {
            boolean started = getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
            if (!started) failConnectionQueue("Android could not bind to FaceFusion AgentBridgeService.");
        } catch (SecurityException error) {
            failConnectionQueue("FaceFusion signature permission mismatch. Install Chilli and FaceFusion builds signed with the same key.");
        } catch (Exception error) {
            failConnectionQueue("Could not bind to FaceFusion: " + error.getMessage());
        }
    }

    private ResolveInfo resolveService() {
        Intent intent = new Intent();
        intent.setComponent(new ComponentName(FACEFUSION_PACKAGE, FACEFUSION_SERVICE));
        try {
            return getContext().getPackageManager().resolveService(intent, PackageManager.MATCH_DEFAULT_ONLY);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean handleReply(Message message) {
        if (destroyed) return true;
        Bundle data = message.getData();
        if (data == null) return true;
        String id = data.getString("requestId", "");
        imageWorker.execute(() -> {
            JSONObject raw = null;
            String outputToRelease = null;
            try {
                PluginCall call;
                synchronized (lock) { call = pending.get(id); }
                raw = new JSONObject(data.getString("json", "{}"));
                outputToRelease = raw.optString("outputUri", "");
                if (call == null) return; // Late responses are released in finally.
                if (!data.getBoolean("ok", false)) {
                    rejectPending(id, data.getString("error", "FaceFusion command failed")); return;
                }
                if (raw.has("outputUri")) attachOutputImage(raw);
                JSObject result = new JSObject();
                Iterator<String> keys = raw.keys();
                while (keys.hasNext()) { String key = keys.next(); result.put(key, raw.get(key)); }
                call = takePending(id);
                if (call != null) { cleanup(call); call.resolve(result); }
            } catch (Exception error) {
                rejectPending(id, "Could not decode FaceFusion response: " + error.getMessage());
            } finally {
                if (outputToRelease != null && !outputToRelease.isEmpty()) releaseOutput(outputToRelease);
            }
        });
        return true;
    }

    private void attachOutputImage(JSONObject raw) throws Exception {
        String outputUri = raw.optString("outputUri", "");
        if (outputUri.isEmpty()) return;
        byte[] bytes = readAll(Uri.parse(outputUri));
        String encoded = Base64.encodeToString(bytes, Base64.NO_WRAP);
        raw.put("image", encoded);
        raw.put("outputUri", "data:image/jpeg;base64," + encoded);
        raw.put("format", "jpeg");
        raw.put("mimeType", "image/jpeg");
    }

    private Uri prepareInputUri(String value, String label) throws Exception {
        if (value.length() > MAX_BYTES * 4 / 3 + 1024) throw new IllegalArgumentException("Image exceeds the 16 MB encoded limit.");
        String trimmed = value.trim();
        Uri uri;
        if (trimmed.startsWith("content://")) {
            uri = Uri.parse(trimmed);
        } else if (trimmed.startsWith("data:image/")) {
            int comma = trimmed.indexOf(',');
            if (comma < 0) throw new IllegalArgumentException("Malformed image data URL");
            String header = trimmed.substring(0, comma);
            String payload = trimmed.substring(comma + 1);
            byte[] bytes = header.contains(";base64")
                    ? Base64.decode(payload, Base64.DEFAULT)
                    : Uri.decode(payload).getBytes(StandardCharsets.UTF_8);
            uri = writeInputFile(bytes, extensionForDataUrl(header), label);
        } else if (trimmed.startsWith("file://")) {
            File file = new File(Uri.parse(trimmed).getPath());
            uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        } else {
            // The web layer normally supplies data: or content: values. Raw
            // base64 remains accepted for agent chaining convenience.
            byte[] bytes = Base64.decode(trimmed, Base64.DEFAULT);
            uri = writeInputFile(bytes, ".jpg", label);
        }

        validateImage(uri);
        getContext().grantUriPermission(
                FACEFUSION_PACKAGE,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
        );
        synchronized (lock) { grants.computeIfAbsent(preparing.get(), k -> new ArrayList<>()).add(uri); }
        return uri;
    }

    private Uri writeInputFile(byte[] bytes, String extension, String label) throws Exception {
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Image exceeds 16 MB.");
        File dir = new File(getContext().getCacheDir(), "agent_inputs");
        sweepInputs(dir);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create Chilli agent input directory");
        File file = new File(dir, label + "-" + UUID.randomUUID() + extension);
        synchronized (lock) { inputs.computeIfAbsent(preparing.get(), k -> new ArrayList<>()).add(file); }
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(bytes);
        }
        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
    }

    private byte[] readAll(Uri uri) throws Exception {
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalArgumentException("Could not read FaceFusion output URI");
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if ((long)output.size() + count > MAX_BYTES) throw new IllegalArgumentException("FaceFusion output exceeds 16 MB.");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private String extensionForDataUrl(String header) {
        String lower = header.toLowerCase();
        if (lower.contains("image/png")) return ".png";
        if (lower.contains("image/webp")) return ".webp";
        return ".jpg";
    }

    private void putOptionalString(Bundle data, String key, String value) {
        if (value != null && !value.trim().isEmpty()) data.putString(key, value.trim());
    }

    private PluginCall takePending(String id) {
        synchronized (lock) {
            Runnable timer = timers.remove(id);
            if (timer != null) deadlines.removeCallbacks(timer);
            return pending.remove(id);
        }
    }

    private void rejectPending(String id, String message) {
        PluginCall call = takePending(id);
        if (call != null) rejectPrepared(call, message);
    }

    private void rejectPrepared(PluginCall call, String message) {
        cleanup(call);
        call.reject(message);
    }

    private void cleanup(PluginCall call) {
        synchronized (lock) {
            List<Uri> uris = grants.remove(call);
            if (uris != null) for (Uri uri : uris)
                getContext().revokeUriPermission(FACEFUSION_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            List<File> files = inputs.remove(call);
            if (files != null) for (File file : files) file.delete();
            if (activeImage == call) activeImage = null;
        }
    }

    private void sweepInputs(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 30 * 60_000L;
        for (File file : files) if (file.lastModified() < cutoff) file.delete();
        long size = 0;
        for (File file : files) size += file.length();
        if (size > 64L * 1024 * 1024) throw new IllegalStateException("FaceFusion temporary storage is full.");
    }

    private void validateImage(Uri uri) throws Exception {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        try (InputStream stream = getContext().getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(stream, null, options);
        }
        if (options.outWidth <= 0 || options.outHeight <= 0) throw new IllegalArgumentException("Invalid image.");
        if ((long)options.outWidth * options.outHeight > MAX_PIXELS)
            throw new IllegalArgumentException("Image exceeds 8 megapixels. Resize it before processing.");
        try (InputStream stream = getContext().getContentResolver().openInputStream(uri)) {
            byte[] buffer = new byte[65536]; long total = 0; int count;
            if (stream == null) throw new IllegalArgumentException("Image is unreadable.");
            while ((count = stream.read(buffer)) != -1) {
                total += count;
                if (total > MAX_BYTES) throw new IllegalArgumentException("Image exceeds 16 MB.");
            }
        }
    }

    private void sendCancellation() { sendUntracked(MSG_CANCEL, new Bundle()); }

    private void releaseOutput(String value) {
        Bundle data = new Bundle(); data.putString("outputUri", value);
        sendUntracked(7, data);
    }

    private void sendUntracked(int command, Bundle data) {
        synchronized (lock) {
            if (serviceMessenger == null) return;
            Message message = Message.obtain(null, command);
            message.replyTo = replyMessenger; message.setData(data);
            try { serviceMessenger.send(message); } catch (RemoteException ignored) {}
        }
    }

    private void closeLostConnection(String message) {
        deadlines.removeCallbacks(bindTimeout);
        try { getContext().unbindService(connection); } catch (IllegalArgumentException ignored) {}
        List<String> ids;
        synchronized (lock) {
            binding = false; bound = false; serviceMessenger = null;
            ids = new ArrayList<>(pending.keySet());
            waitingForConnection.clear();
        }
        for (String id : ids) rejectPending(id, message);
    }

    private void failConnectionQueue(String message) { closeLostConnection(message); }
}
