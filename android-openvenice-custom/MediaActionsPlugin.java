package ai.openvenice.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "MediaActions")
public final class MediaActionsPlugin extends Plugin {
    private static final String CRASH_FILE_NAME = "openvenice-last-crash.txt";

    /**
     * Exports the last crash report into public Downloads via MediaStore —
     * visible from any file manager on Android 10+ without permissions.
     * Called automatically after a fatal exception; safe to call anytime.
     */
    private void exportCrashToDownloads() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        try {
            Context context = getContext();
            File internal = new File(context.getCacheDir(), CRASH_FILE_NAME);
            File external = context.getExternalFilesDir(null);
            File externalFile = external != null ? new File(external, CRASH_FILE_NAME) : null;
            File source = internal.exists() ? internal : (externalFile != null && externalFile.exists() ? externalFile : null);
            if (source == null || source.length() == 0) return;

            ContentResolver resolver = context.getContentResolver();
            // Avoid duplicates: replace the previous export if present.
            String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?";
            try (android.database.Cursor cursor = resolver.query(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.MediaColumns._ID},
                selection,
                new String[]{CRASH_FILE_NAME, Environment.DIRECTORY_DOWNLOADS + "/"},
                null)) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(0);
                        resolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                            MediaStore.MediaColumns._ID + "=?", new String[]{String.valueOf(id)});
                    }
                }
            }

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, CRASH_FILE_NAME);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (target == null) return;
            try (InputStream in = new java.io.FileInputStream(source);
                 OutputStream out = resolver.openOutputStream(target)) {
                if (out == null) return;
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            }
        } catch (Throwable ignored) {
            // Crash export is best-effort only.
        }
    }

    @PluginMethod
    public void getLastCrash(PluginCall call) {
        try {
            Context context = getContext();
            File internal = new File(context.getCacheDir(), CRASH_FILE_NAME);
            File external = context.getExternalFilesDir(null);
            File externalFile = external != null ? new File(external, CRASH_FILE_NAME) : null;
            File source = internal.exists() ? internal : (externalFile != null && externalFile.exists() ? externalFile : null);
            JSObject result = new JSObject();
            if (source == null || source.length() == 0) {
                result.put("found", false);
                call.resolve(result);
                return;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream in = new java.io.FileInputStream(source)) {
                byte[] chunk = new byte[8192];
                int read;
                while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
            }
            String content = buffer.toString("UTF-8");
            // Trim to a reasonable paste size.
            if (content.length() > 12000) content = content.substring(0, 12000) + "\n…(truncated)";
            result.put("found", true);
            result.put("path", source.getAbsolutePath());
            result.put("content", content);
            call.resolve(result);
        } catch (Throwable error) {
            call.reject("Could not read crash report: " + (error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName()));
        }
    }

    @PluginMethod
    public void clearLastCrash(PluginCall call) {
        try {
            Context context = getContext();
            new File(context.getCacheDir(), CRASH_FILE_NAME).delete();
            File external = context.getExternalFilesDir(null);
            if (external != null) new File(external, CRASH_FILE_NAME).delete();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentResolver resolver = context.getContentResolver();
                    resolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                        new String[]{CRASH_FILE_NAME, Environment.DIRECTORY_DOWNLOADS + "/"});
                } catch (Throwable ignored) {
                }
            }
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not clear crash report: " + (error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName()));
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("text is required");
            return;
        }
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            launchChooser(send, "Share from OpenVenice");
            call.resolve();
        } catch (Exception error) {
            call.reject(message(error, "Could not share text"));
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String value = call.getString("imageUri");
        if (value == null || value.trim().isEmpty()) {
            call.reject("imageUri is required");
            return;
        }
        try {
            String mime = normalizeMime(call.getString("mimeType"));
            Uri uri = prepareShareUri(value, mime, "share");
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newUri(getContext().getContentResolver(), "OpenVenice image", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            launchChooser(send, "Share image");
            call.resolve();
        } catch (Exception error) {
            call.reject(message(error, "Could not share image"));
        }
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        String value = call.getString("imageUri");
        if (value == null || value.trim().isEmpty()) {
            call.reject("imageUri is required");
            return;
        }
        try {
            String mime = normalizeMime(call.getString("mimeType"));
            String requestedName = call.getString("fileName");
            String fileName = sanitizeFileName(requestedName, mime);
            byte[] bytes = readImageBytes(value);
            Uri saved = writeToGallery(bytes, mime, fileName);
            JSObject result = new JSObject();
            result.put("uri", saved.toString());
            result.put("fileName", fileName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(message(error, "Could not save image"));
        }
    }

    @PluginMethod
    public void copyImage(PluginCall call) {
        String value = call.getString("imageUri");
        if (value == null || value.trim().isEmpty()) {
            call.reject("imageUri is required");
            return;
        }
        try {
            String mime = normalizeMime(call.getString("mimeType"));
            Uri uri = prepareShareUri(value, mime, "clipboard");
            ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) throw new IllegalStateException("Android clipboard is unavailable");
            clipboard.setPrimaryClip(ClipData.newUri(getContext().getContentResolver(), "OpenVenice image", uri));
            call.resolve();
        } catch (Exception error) {
            call.reject(message(error, "Could not copy image"));
        }
    }

    private void launchChooser(Intent send, String title) {
        Intent chooser = Intent.createChooser(send, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
    }

    private Uri prepareShareUri(String value, String mime, String label) throws Exception {
        String trimmed = value.trim();
        if (trimmed.startsWith("content://")) return Uri.parse(trimmed);
        if (trimmed.startsWith("file://")) {
            File file = new File(Uri.parse(trimmed).getPath());
            return FileProvider.getUriForFile(getContext(), authority(), file);
        }
        byte[] bytes = readImageBytes(trimmed);
        File dir = new File(getContext().getCacheDir(), "media_actions");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create media cache directory");
        File file = new File(dir, label + "-" + UUID.randomUUID() + extensionForMime(mime));
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(bytes);
        }
        return FileProvider.getUriForFile(getContext(), authority(), file);
    }

    private byte[] readImageBytes(String value) throws Exception {
        String trimmed = value.trim();
        if (trimmed.startsWith("data:image/")) {
            int comma = trimmed.indexOf(',');
            if (comma < 0) throw new IllegalArgumentException("Malformed image data URL");
            String header = trimmed.substring(0, comma);
            String payload = trimmed.substring(comma + 1);
            return header.contains(";base64")
                    ? Base64.decode(payload, Base64.DEFAULT)
                    : Uri.decode(payload).getBytes(StandardCharsets.UTF_8);
        }
        if (trimmed.startsWith("content://") || trimmed.startsWith("file://")) {
            return readAll(Uri.parse(trimmed));
        }
        return Base64.decode(trimmed, Base64.DEFAULT);
    }

    private byte[] readAll(Uri uri) throws Exception {
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalArgumentException("Could not read image URI");
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }

    private Uri writeToGallery(byte[] bytes, String mime, String fileName) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mime);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/OpenVenice");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }

        Uri target = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (target == null) throw new IllegalStateException("Android MediaStore could not create the image");
        boolean completed = false;
        try (OutputStream output = resolver.openOutputStream(target, "w")) {
            if (output == null) throw new IllegalStateException("Could not open gallery output stream");
            output.write(bytes);
            output.flush();
            completed = true;
        } finally {
            if (!completed) resolver.delete(target, null, null);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(target, ready, null, null);
        }
        return target;
    }

    private String sanitizeFileName(String requested, String mime) {
        String extension = extensionForMime(mime);
        String base = requested == null || requested.trim().isEmpty()
                ? "openvenice-" + System.currentTimeMillis()
                : requested.trim().replaceAll("[^A-Za-z0-9._-]", "-");
        if (!base.toLowerCase(Locale.US).endsWith(extension)) base += extension;
        return base;
    }

    private String normalizeMime(String value) {
        if (value == null || !value.toLowerCase(Locale.US).startsWith("image/")) return "image/jpeg";
        return value.toLowerCase(Locale.US);
    }

    private String extensionForMime(String mime) {
        String lower = mime.toLowerCase(Locale.US);
        if (lower.contains("png")) return ".png";
        if (lower.contains("webp")) return ".webp";
        if (lower.contains("gif")) return ".gif";
        return ".jpg";
    }

    private String authority() {
        return getContext().getPackageName() + ".fileprovider";
    }

    private String message(Exception error, String fallback) {
        String value = error.getMessage();
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
