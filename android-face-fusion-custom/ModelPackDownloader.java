package com.pv.androidfacefusion;

import android.content.Context;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Downloads Complete Models packs into the FaceFusion private files directory.
 * Used by the UI catalog and by the OpenVenice agent bridge so Shahy can
 * bootstrap the minimum on-device runtime without a manual tap.
 */
public final class ModelPackDownloader {
    private static final String TAG = "ModelPackDownloader";
    private static final long MIN_BYTES = 1024 * 1024L;

    public static final List<String> MINIMUM_PACK_IDS = Arrays.asList(
            "analysis_retinaface",
            "analysis_arcface",
            "analysis_2dfan4",
            "inswapper_128_fp16"
    );

    public static final List<String> OPTIONAL_QUALITY_PACK_IDS = Arrays.asList(
            "codeformer",
            "real_esrgan_x4_fp16"
    );

    public static final List<String> SWAPPER_FALLBACK_IDS = Arrays.asList(
            "inswapper_128_fp16",
            "inswapper_128"
    );

    private final File filesDir;

    public ModelPackDownloader(Context context) {
        this.filesDir = context.getApplicationContext().getFilesDir();
    }

    public static ModelCatalog.ModelPack packById(String id) {
        if (id == null) return null;
        String needle = id.trim();
        for (ModelCatalog.ModelPack pack : ModelCatalog.all()) {
            if (pack.id.equals(needle) || pack.name.equalsIgnoreCase(needle)) return pack;
            for (ModelCatalog.ModelFile file : pack.files) {
                if (file.name.equals(needle) || file.name.equals(needle + ".onnx")) return pack;
            }
        }
        return null;
    }

    public boolean isDownloaded(ModelCatalog.ModelPack pack) {
        if (pack == null || pack.files.isEmpty()) return false;
        for (ModelCatalog.ModelFile file : pack.files) {
            File local = new File(filesDir, file.name);
            if (!local.exists() || local.length() < MIN_BYTES) return false;
        }
        return true;
    }

    public boolean categoryDownloaded(String category) {
        for (ModelCatalog.ModelPack pack : ModelCatalog.all()) {
            if (category.equals(pack.category) && isDownloaded(pack)) return true;
        }
        return false;
    }

    public boolean runtimeSwapperDownloaded() {
        for (String id : SWAPPER_FALLBACK_IDS) {
            ModelCatalog.ModelPack pack = packById(id);
            if (isDownloaded(pack)) return true;
        }
        for (ModelCatalog.ModelPack pack : ModelCatalog.all()) {
            if ("Face swapper".equals(pack.category) && pack.selectableSwapper && isDownloaded(pack)) return true;
        }
        return false;
    }

    public boolean isRuntimeReady() {
        return categoryDownloaded("Detection")
                && categoryDownloaded("Recognition")
                && categoryDownloaded("Landmarks")
                && runtimeSwapperDownloaded();
    }

    public List<String> missingMinimumIds() {
        List<String> missing = new ArrayList<>();
        if (!categoryDownloaded("Detection")) missing.add("analysis_retinaface");
        if (!categoryDownloaded("Recognition")) missing.add("analysis_arcface");
        if (!categoryDownloaded("Landmarks")) missing.add("analysis_2dfan4");
        if (!runtimeSwapperDownloaded()) missing.add("inswapper_128_fp16");
        return missing;
    }

    public List<String> resolveRequestedIds(List<String> requested, boolean includeOptional) {
        Set<String> ids = new LinkedHashSet<>();
        if (requested == null || requested.isEmpty()) {
            ids.addAll(missingMinimumIds());
        } else {
            ids.addAll(requested);
        }
        if (includeOptional) {
            for (String optional : OPTIONAL_QUALITY_PACK_IDS) {
                ModelCatalog.ModelPack pack = packById(optional);
                if (!isDownloaded(pack)) ids.add(optional);
            }
        }
        return new ArrayList<>(ids);
    }

    public String preferredSwapperFile() {
        for (String id : SWAPPER_FALLBACK_IDS) {
            ModelCatalog.ModelPack pack = packById(id);
            if (isDownloaded(pack) && !pack.files.isEmpty()) return pack.files.get(0).name;
        }
        return "inswapper_128.onnx";
    }

    public void downloadPack(ModelCatalog.ModelPack pack) throws Exception {
        if (pack == null) throw new IllegalArgumentException("Unknown FaceFusion model pack");
        if (isDownloaded(pack)) return;
        Log.i(TAG, "Downloading pack " + pack.id);
        for (ModelCatalog.ModelFile file : pack.files) downloadFile(file);
    }

    private void downloadFile(ModelCatalog.ModelFile model) throws Exception {
        File out = new File(filesDir, model.name);
        Exception last = null;
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                long existing = out.exists() ? out.length() : 0L;
                HttpURLConnection conn = open(model.url, existing);
                int code = conn.getResponseCode();
                if (code == 416) {
                    conn.disconnect();
                    if (out.exists() && !out.delete()) {
                        throw new Exception("Could not reset incomplete " + model.name);
                    }
                    existing = 0;
                    conn = open(model.url, 0);
                    code = conn.getResponseCode();
                }
                boolean partial = code == 206;
                if (code != 200 && !partial) throw new Exception("HTTP " + code + " for " + model.name);
                long total = conn.getContentLengthLong();
                if (partial && total >= 0) total += existing;
                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream fos = new FileOutputStream(out, partial)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) >= 0) fos.write(buf, 0, n);
                    fos.flush();
                } finally {
                    conn.disconnect();
                }
                if (total > 0 && out.length() != total) {
                    long actual = out.length();
                    if (!out.delete()) Log.w(TAG, "Could not delete incomplete " + model.name);
                    throw new Exception("Incomplete download: expected " + total + " bytes, got " + actual);
                }
                if (out.length() < MIN_BYTES) {
                    if (!out.delete()) Log.w(TAG, "Could not delete tiny " + model.name);
                    throw new Exception("Downloaded file is unexpectedly small");
                }
                return;
            } catch (Exception error) {
                last = error;
                Log.w(TAG, "Download attempt " + (attempt + 1) + " failed for " + model.name, error);
                try {
                    Thread.sleep(1500L * (attempt + 1));
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw interrupted;
                }
            }
        }
        throw last != null ? last : new Exception("Download failed for " + model.name);
    }

    private HttpURLConnection open(String initial, long offset) throws Exception {
        String current = initial;
        for (int redirects = 0; redirects < 10; redirects++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(60_000);
            connection.setReadTimeout(180_000);
            connection.setRequestProperty("User-Agent", "OpenVenice-FaceFusion/EnsureModels");
            connection.setRequestProperty("Accept-Encoding", "identity");
            if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
            int code = connection.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String next = connection.getHeaderField("Location");
                connection.disconnect();
                if (next == null) throw new Exception("Redirect without Location");
                current = new URL(new URL(current), next).toString();
                continue;
            }
            return connection;
        }
        throw new Exception("Too many redirects");
    }
}
