package com.pv.androidfacefusion;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.util.Log;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.DoubleBuffer;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.HashMap;
import java.util.Map;

import ai.onnxruntime.NodeInfo;
import ai.onnxruntime.OnnxJavaType;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.TensorInfo;

/**
 * Complete Models v3 face-swap runtime.
 *
 * Supports the FaceFusion preprocessing paths for:
 * INSwapper, Ghost, SimSwap, HyperSwap and UniFace.
 * Model files are downloaded separately by Complete Models and stay on-device.
 */
public class FaceSwapper {
    private static final String TAG = "FaceSwapperV3";
    private static final String PREFS = "model_settings";

    private static final class Spec {
        final String file;
        final String type;
        final String template;
        final int size;
        final float[] mean;
        final float[] std;
        final String converter;
        final String sourceTemplate;
        final int sourceSize;

        Spec(String file, String type, String template, int size,
             float[] mean, float[] std, String converter,
             String sourceTemplate, int sourceSize) {
            this.file = file;
            this.type = type;
            this.template = template;
            this.size = size;
            this.mean = mean;
            this.std = std;
            this.converter = converter;
            this.sourceTemplate = sourceTemplate;
            this.sourceSize = sourceSize;
        }
    }

    private final Context context;
    private final OrtEnvironment env;
    private OrtSession session;
    private OrtSession converterSession;
    private Spec spec;
    private float[][] emap;

    public FaceSwapper(Context context) {
        this.context = context.getApplicationContext();
        this.env = OrtEnvironment.getEnvironment();
    }

    public void initialize() throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String selected = prefs.getString("swapper_model", "inswapper_128.onnx");
        spec = specFor(selected);
        if (spec == null) {
            Log.w(TAG, "Unsupported selected swapper " + selected + "; falling back to INSwapper 128");
            spec = specFor("inswapper_128.onnx");
            prefs.edit().putString("swapper_model", spec.file).apply();
        }

        File model = resolveModelFile(spec.file);
        if (model == null) {
            spec = specFor("inswapper_128.onnx");
            prefs.edit().putString("swapper_model", spec.file).apply();
            model = new ModelDownloader(context).getModelFile(spec.file);
        }

        if (spec.converter != null) {
            File converter = new File(context.getFilesDir(), spec.converter);
            if (!valid(converter)) {
                Log.w(TAG, "Converter missing for " + spec.file + "; falling back to INSwapper 128");
                spec = specFor("inswapper_128.onnx");
                prefs.edit().putString("swapper_model", spec.file).apply();
                model = new ModelDownloader(context).getModelFile(spec.file);
            } else {
                converterSession = OrtSessionHelper.createSession(env, converter.getAbsolutePath(), TAG + "Converter");
            }
        }

        session = OrtSessionHelper.createSession(env, model.getAbsolutePath(), TAG);
        if ("inswapper".equals(spec.type)) {
            emap = loadEmapFromAssets();
        }
        Log.i(TAG, "Loaded swapper " + spec.file + " type=" + spec.type + " size=" + spec.size);
    }

    private File resolveModelFile(String file) throws Exception {
        File model = new File(context.getFilesDir(), file);
        if (valid(model)) return model;
        if ("inswapper_128.onnx".equals(file)) {
            return new ModelDownloader(context).getModelFile(file);
        }
        return null;
    }

    private boolean valid(File f) {
        return f != null && f.exists() && f.length() > 1024 * 1024L;
    }

    public int getTargetSize() {
        return spec != null ? spec.size : 128;
    }

    public String getTemplate() {
        return spec != null ? spec.template : "arcface_128";
    }

    public boolean requiresSourceFrame() {
        return spec != null && "uniface".equals(spec.type);
    }

    public String getSourceTemplate() {
        return spec != null && spec.sourceTemplate != null ? spec.sourceTemplate : "arcface_112_v2";
    }

    public int getSourceSize() {
        return spec != null && spec.sourceSize > 0 ? spec.sourceSize : 112;
    }

    public String getSelectedModel() {
        return spec != null ? spec.file : "inswapper_128.onnx";
    }

    /** Compatibility path used by the Face Library. */
    public Bitmap swapFace(Bitmap targetFace, float[] sourceEmbedding, Bitmap targetImage) throws Exception {
        return swapFace(targetFace, sourceEmbedding, targetImage, null);
    }

    /** Standard-swap path; sourceFrame is required by UniFace and ignored by embedding swappers. */
    public Bitmap swapFace(Bitmap targetFace, float[] sourceEmbedding, Bitmap targetImage,
                           Bitmap sourceFrame) throws Exception {
        if (session == null || spec == null) throw new IllegalStateException("Face swapper not initialized");
        if (requiresSourceFrame() && sourceFrame == null) {
            throw new Exception("UniFace needs the original source face image. Use Standard Swap instead of Face Library.");
        }

        Map<String, OnnxTensor> inputs = new HashMap<>();
        OnnxTensor sourceTensor = null;
        OnnxTensor targetTensor = null;
        OrtSession.Result result = null;

        try {
            for (Map.Entry<String, NodeInfo> e : session.getInputInfo().entrySet()) {
                String name = e.getKey();
                TensorInfo info = (TensorInfo) e.getValue().getInfo();
                if ("source".equals(name)) {
                    if (requiresSourceFrame()) {
                        float[] sourceData = bitmapToCHW(sourceFrame,
                                new float[]{0f, 0f, 0f}, new float[]{1f, 1f, 1f});
                        sourceTensor = createTensor(sourceData,
                                new long[]{1, 3, sourceFrame.getHeight(), sourceFrame.getWidth()}, info.type);
                    } else {
                        float[] prepared = prepareSourceEmbedding(sourceEmbedding);
                        sourceTensor = createTensor(prepared, new long[]{1, prepared.length}, info.type);
                    }
                    inputs.put(name, sourceTensor);
                } else if ("target".equals(name)) {
                    Bitmap sized = targetFace;
                    if (targetFace.getWidth() != spec.size || targetFace.getHeight() != spec.size) {
                        sized = Bitmap.createScaledBitmap(targetFace, spec.size, spec.size, true);
                    }
                    float[] targetData = bitmapToCHW(sized, spec.mean, spec.std);
                    targetTensor = createTensor(targetData, new long[]{1, 3, spec.size, spec.size}, info.type);
                    inputs.put(name, targetTensor);
                    if (sized != targetFace) sized.recycle();
                }
            }

            if (sourceTensor == null || targetTensor == null) {
                throw new Exception("Selected swapper does not expose expected source/target inputs");
            }

            result = session.run(inputs);
            OnnxTensor out = (OnnxTensor) result.get(0);
            return tensorToBitmap(out, shouldDenormalizeOutput());
        } finally {
            if (sourceTensor != null) sourceTensor.close();
            if (targetTensor != null) targetTensor.close();
            if (result != null) result.close();
        }
    }

    private float[] prepareSourceEmbedding(float[] embedding) throws Exception {
        if (embedding == null || embedding.length == 0) throw new Exception("Source embedding is empty");

        if ("inswapper".equals(spec.type)) {
            return applyEmap(embedding);
        }
        if ("hyperswap".equals(spec.type)) {
            return l2Normalize(embedding);
        }
        if ("ghost".equals(spec.type)) {
            return convertEmbedding(embedding, false);
        }
        if ("simswap".equals(spec.type)) {
            return convertEmbedding(embedding, true);
        }
        return l2Normalize(embedding);
    }

    private float[] convertEmbedding(float[] embedding, boolean normalize) throws Exception {
        if (converterSession == null) throw new Exception("Required embedding converter is not loaded");
        Map.Entry<String, NodeInfo> first = converterSession.getInputInfo().entrySet().iterator().next();
        TensorInfo info = (TensorInfo) first.getValue().getInfo();
        OnnxTensor input = createTensor(embedding, new long[]{1, embedding.length}, info.type);
        OrtSession.Result result = null;
        try {
            Map<String, OnnxTensor> map = new HashMap<>();
            map.put(first.getKey(), input);
            result = converterSession.run(map);
            float[] converted = readFlat((OnnxTensor) result.get(0));
            return normalize ? l2Normalize(converted) : converted;
        } finally {
            input.close();
            if (result != null) result.close();
        }
    }

    private float[] applyEmap(float[] embedding) {
        if (emap == null || emap.length != embedding.length) return l2Normalize(embedding);
        float norm = 0f;
        for (float v : embedding) norm += v * v;
        norm = (float) Math.sqrt(norm);
        if (norm < 1e-8f) norm = 1f;

        float[] out = new float[embedding.length];
        for (int i = 0; i < embedding.length; i++) {
            float sum = 0f;
            for (int j = 0; j < embedding.length; j++) sum += embedding[j] * emap[j][i];
            out[i] = sum / norm;
        }
        return out;
    }

    private float[] l2Normalize(float[] values) {
        float norm = 0f;
        for (float v : values) norm += v * v;
        norm = (float) Math.sqrt(norm);
        if (norm < 1e-8f) return values.clone();
        float[] out = new float[values.length];
        for (int i = 0; i < values.length; i++) out[i] = values[i] / norm;
        return out;
    }

    private boolean shouldDenormalizeOutput() {
        return "ghost".equals(spec.type) || "hyperswap".equals(spec.type) || "uniface".equals(spec.type);
    }

    private float[] bitmapToCHW(Bitmap bitmap, float[] mean, float[] std) {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        int[] pixels = new int[w * h];
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h);
        int plane = pixels.length;
        float[] out = new float[plane * 3];
        for (int i = 0; i < plane; i++) {
            int p = pixels[i];
            float r = ((p >> 16) & 0xFF) / 255f;
            float g = ((p >> 8) & 0xFF) / 255f;
            float b = (p & 0xFF) / 255f;
            out[i] = (r - mean[0]) / std[0];
            out[plane + i] = (g - mean[1]) / std[1];
            out[2 * plane + i] = (b - mean[2]) / std[2];
        }
        return out;
    }

    private Bitmap tensorToBitmap(OnnxTensor tensor, boolean denormalize) throws Exception {
        TensorInfo info = tensor.getInfo();
        long[] shape = info.getShape();
        if (shape.length != 4 || shape[0] != 1 || shape[1] < 3) {
            throw new Exception("Unsupported swapper output shape");
        }
        int h = (int) shape[2];
        int w = (int) shape[3];
        int plane = h * w;
        float[] data = readFlat(tensor);
        if (data.length < plane * 3) throw new Exception("Swapper output is too small");

        int[] pixels = new int[plane];
        for (int i = 0; i < plane; i++) {
            float r = data[i];
            float g = data[plane + i];
            float b = data[2 * plane + i];
            if (denormalize) {
                r = r * spec.std[0] + spec.mean[0];
                g = g * spec.std[1] + spec.mean[1];
                b = b * spec.std[2] + spec.mean[2];
            }
            int ri = clamp255(Math.round(clamp01(r) * 255f));
            int gi = clamp255(Math.round(clamp01(g) * 255f));
            int bi = clamp255(Math.round(clamp01(b) * 255f));
            pixels[i] = 0xFF000000 | (ri << 16) | (gi << 8) | bi;
        }
        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        out.setPixels(pixels, 0, w, 0, 0, w, h);
        return out;
    }

    private float[] readFlat(OnnxTensor tensor) throws Exception {
        TensorInfo info = tensor.getInfo();
        long countLong = 1;
        for (long d : info.getShape()) countLong *= Math.max(1, d);
        int count = (int) countLong;
        float[] out = new float[count];
        if (info.type == OnnxJavaType.FLOAT16) {
            ShortBuffer sb = tensor.getShortBuffer();
            if (sb == null) throw new Exception("Cannot read FP16 tensor");
            for (int i = 0; i < count; i++) out[i] = halfToFloat(sb.get(i));
        } else if (info.type == OnnxJavaType.DOUBLE) {
            DoubleBuffer db = tensor.getDoubleBuffer();
            if (db == null) throw new Exception("Cannot read double tensor");
            for (int i = 0; i < count; i++) out[i] = (float) db.get(i);
        } else {
            FloatBuffer fb = tensor.getFloatBuffer();
            if (fb == null) throw new Exception("Cannot read float tensor");
            for (int i = 0; i < count; i++) out[i] = fb.get(i);
        }
        return out;
    }

    private OnnxTensor createTensor(float[] values, long[] shape, OnnxJavaType type) throws Exception {
        if (type == OnnxJavaType.FLOAT16) {
            ByteBuffer bytes = ByteBuffer.allocateDirect(values.length * 2).order(ByteOrder.nativeOrder());
            for (float v : values) bytes.putShort(floatToHalf(v));
            bytes.rewind();
            return OnnxTensor.createTensor(env, bytes, shape, OnnxJavaType.FLOAT16);
        }
        if (type == OnnxJavaType.DOUBLE) {
            double[] d = new double[values.length];
            for (int i = 0; i < values.length; i++) d[i] = values[i];
            return OnnxTensor.createTensor(env, DoubleBuffer.wrap(d), shape);
        }
        return OnnxTensor.createTensor(env, FloatBuffer.wrap(values), shape);
    }

    private float clamp01(float v) { return Math.max(0f, Math.min(1f, v)); }
    private int clamp255(int v) { return Math.max(0, Math.min(255, v)); }

    private float[][] loadEmapFromAssets() throws IOException {
        try (InputStream in = context.getAssets().open("emap.bin")) {
            byte[] header = new byte[8];
            if (in.read(header) != 8) throw new IOException("Invalid EMAP header");
            ByteBuffer hb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
            int rows = hb.getInt();
            int cols = hb.getInt();
            if (rows != 512 || cols != 512) throw new IOException("Invalid EMAP dimensions");
            byte[] bytes = new byte[rows * cols * 4];
            int read = 0;
            while (read < bytes.length) {
                int n = in.read(bytes, read, bytes.length - read);
                if (n < 0) throw new IOException("Unexpected EOF reading EMAP");
                read += n;
            }
            ByteBuffer bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            float[][] matrix = new float[rows][cols];
            for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) matrix[r][c] = bb.getFloat();
            return matrix;
        }
    }

    private short floatToHalf(float value) {
        int bits = Float.floatToIntBits(value);
        int sign = (bits >>> 16) & 0x8000;
        int val = (bits & 0x7fffffff) + 0x1000;
        if (val >= 0x47800000) {
            if ((bits & 0x7fffffff) >= 0x47800000) {
                if (val < 0x7f800000) return (short) (sign | 0x7c00);
                return (short) (sign | 0x7c00 | ((bits & 0x007fffff) >>> 13));
            }
            return (short) (sign | 0x7bff);
        }
        if (val >= 0x38800000) return (short) (sign | ((val - 0x38000000) >>> 13));
        if (val < 0x33000000) return (short) sign;
        val = (bits & 0x7fffffff) >>> 23;
        return (short) (sign | ((((bits & 0x7fffff) | 0x800000) + (0x800000 >>> (val - 102))) >>> (126 - val)));
    }

    private float halfToFloat(short half) {
        int h = half & 0xFFFF;
        int sign = (h & 0x8000) << 16;
        int exp = (h >>> 10) & 0x1F;
        int mant = h & 0x03FF;
        int bits;
        if (exp == 0) {
            if (mant == 0) bits = sign;
            else {
                exp = 1;
                while ((mant & 0x0400) == 0) { mant <<= 1; exp--; }
                mant &= 0x03FF;
                bits = sign | ((exp + 112) << 23) | (mant << 13);
            }
        } else if (exp == 31) bits = sign | 0x7F800000 | (mant << 13);
        else bits = sign | ((exp + 112) << 23) | (mant << 13);
        return Float.intBitsToFloat(bits);
    }

    private Spec specFor(String file) {
        float[] zero = new float[]{0f, 0f, 0f};
        float[] one = new float[]{1f, 1f, 1f};
        float[] half = new float[]{0.5f, 0.5f, 0.5f};

        if ("inswapper_128.onnx".equals(file) || "inswapper_128_fp16.onnx".equals(file))
            return new Spec(file, "inswapper", "arcface_128", 128, zero, one, null, null, 0);
        if ("ghost_1_256.onnx".equals(file) || "ghost_2_256.onnx".equals(file) || "ghost_3_256.onnx".equals(file))
            return new Spec(file, "ghost", "arcface_112_v1", 256, half, half, "crossface_ghost.onnx", null, 0);
        if ("hyperswap_1a_256.onnx".equals(file) || "hyperswap_1b_256.onnx".equals(file) || "hyperswap_1c_256.onnx".equals(file))
            return new Spec(file, "hyperswap", "arcface_128", 256, half, half, null, null, 0);
        if ("simswap_256.onnx".equals(file))
            return new Spec(file, "simswap", "arcface_112_v1", 256,
                    new float[]{0.485f, 0.456f, 0.406f}, new float[]{0.229f, 0.224f, 0.225f},
                    "crossface_simswap.onnx", null, 0);
        if ("simswap_unofficial_512.onnx".equals(file))
            return new Spec(file, "simswap", "arcface_112_v1", 512, zero, one,
                    "crossface_simswap.onnx", null, 0);
        if ("uniface_256.onnx".equals(file))
            return new Spec(file, "uniface", "ffhq_512", 256, half, half, null, "ffhq_512", 256);
        return null;
    }

    public void close() {
        try { if (session != null) session.close(); } catch (Exception ignored) {}
        try { if (converterSession != null) converterSession.close(); } catch (Exception ignored) {}
        session = null;
        converterSession = null;
    }
}
