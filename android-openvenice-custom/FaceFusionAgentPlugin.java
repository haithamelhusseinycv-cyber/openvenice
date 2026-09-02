package ai.openvenice.app;

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

    private Messenger serviceMessenger;
    private boolean binding;
    private boolean bound;

    private final Messenger replyMessenger = new Messenger(new Handler(Looper.getMainLooper(), this::handleReply));

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
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
            synchronized (lock) {
                serviceMessenger = null;
                binding = false;
                bound = false;
            }
        }

        @Override
        public void onBindingDied(ComponentName name) {
            onServiceDisconnected(name);
        }

        @Override
        public void onNullBinding(ComponentName name) {
            failConnectionQueue("FaceFusion agent service returned a null binding.");
        }
    };

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
        String input = call.getString("imageUri");
        if (input == null || input.trim().isEmpty()) {
            call.reject("imageUri is required");
            return;
        }
        try {
            Uri imageUri = prepareInputUri(input, "detect");
            Bundle data = new Bundle();
            data.putString("imageUri", imageUri.toString());
            sendCommand(call, MSG_DETECT_FACES, data);
        } catch (Exception error) {
            call.reject(error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion image");
        }
    }

    @PluginMethod
    public void swap(PluginCall call) {
        String source = call.getString("sourceUri");
        String target = call.getString("targetUri");
        if (source == null || target == null) {
            call.reject("sourceUri and targetUri are required");
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
            call.reject(error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion swap");
        }
    }

    @PluginMethod
    public void enhance(PluginCall call) {
        String input = call.getString("imageUri");
        if (input == null || input.trim().isEmpty()) {
            call.reject("imageUri is required");
            return;
        }
        try {
            Bundle data = new Bundle();
            data.putString("imageUri", prepareInputUri(input, "enhance").toString());
            putOptionalString(data, "faceEnhancer", call.getString("faceEnhancer"));
            putOptionalString(data, "frameEnhancer", call.getString("frameEnhancer"));
            sendCommand(call, MSG_ENHANCE, data);
        } catch (Exception error) {
            call.reject(error.getMessage() != null ? error.getMessage() : "Could not prepare FaceFusion enhancement");
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        sendCommand(call, MSG_CANCEL, new Bundle());
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        synchronized (lock) {
            if (bound) {
                try {
                    getContext().unbindService(connection);
                } catch (Exception ignored) {}
            }
            bound = false;
            binding = false;
            serviceMessenger = null;
            for (PluginCall call : pending.values()) call.reject("FaceFusion agent bridge closed");
            pending.clear();
            for (Runnable ignored : waitingForConnection) {}
            waitingForConnection.clear();
        }
    }

    private void sendCommand(PluginCall call, int command, Bundle data) {
        final String requestId = UUID.randomUUID().toString();
        data.putString("requestId", requestId);
        synchronized (lock) {
            pending.put(requestId, call);
        }

        withConnection(call, () -> {
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
        }

        if (resolveService() == null) {
            failConnectionQueue("FaceFusion AgentBridgeService is not installed.");
            return;
        }

        Intent intent = new Intent();
        intent.setComponent(new ComponentName(FACEFUSION_PACKAGE, FACEFUSION_SERVICE));
        try {
            boolean started = getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
            if (!started) failConnectionQueue("Android could not bind to FaceFusion AgentBridgeService.");
        } catch (SecurityException error) {
            failConnectionQueue("FaceFusion signature permission mismatch. Install OpenVenice and FaceFusion builds signed with the same key.");
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
        Bundle data = message.getData();
        if (data == null) return true;
        String requestId = data.getString("requestId", "");
        PluginCall call;
        synchronized (lock) {
            call = pending.remove(requestId);
        }
        if (call == null) return true;

        if (!data.getBoolean("ok", false)) {
            call.reject(data.getString("error", "FaceFusion agent command failed"));
            return true;
        }

        String json = data.getString("json", "{}");
        try {
            JSONObject raw = new JSONObject(json);
            if (raw.has("outputUri")) attachOutputImage(raw);
            JSObject result = new JSObject();
            Iterator<String> keys = raw.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                result.put(key, raw.get(key));
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not decode FaceFusion response: " + error.getMessage());
        }
        return true;
    }

    private void attachOutputImage(JSONObject raw) throws Exception {
        String outputUri = raw.optString("outputUri", "");
        if (outputUri.isEmpty()) return;
        byte[] bytes = readAll(Uri.parse(outputUri));
        raw.put("image", Base64.encodeToString(bytes, Base64.NO_WRAP));
        raw.put("format", "jpeg");
        raw.put("mimeType", "image/jpeg");
    }

    private Uri prepareInputUri(String value, String label) throws Exception {
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

        getContext().grantUriPermission(
                FACEFUSION_PACKAGE,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
        );
        return uri;
    }

    private Uri writeInputFile(byte[] bytes, String extension, String label) throws Exception {
        File dir = new File(getContext().getCacheDir(), "agent_inputs");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create OpenVenice agent input directory");
        File file = new File(dir, label + "-" + UUID.randomUUID() + extension);
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
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
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

    private void rejectPending(String requestId, String message) {
        PluginCall call;
        synchronized (lock) {
            call = pending.remove(requestId);
        }
        if (call != null) call.reject(message);
    }

    private void failConnectionQueue(String message) {
        List<PluginCall> calls;
        synchronized (lock) {
            binding = false;
            bound = false;
            serviceMessenger = null;
            calls = new ArrayList<>(pending.values());
            pending.clear();
            waitingForConnection.clear();
        }
        for (PluginCall call : calls) call.reject(message);
    }
}
