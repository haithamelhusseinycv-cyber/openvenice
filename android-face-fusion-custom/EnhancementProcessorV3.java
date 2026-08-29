package com.pv.androidfacefusion;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.util.Log;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.DoubleBuffer;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import ai.onnxruntime.NodeInfo;
import ai.onnxruntime.OnnxJavaType;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.TensorInfo;

/** Complete Models v3 face restoration and final-image enhancement pipeline. */
public final class EnhancementProcessor {
    private static final String TAG = "EnhancementProcessorV3";
    private static final String PREFS = "model_settings";

    private final Context context;
    private final FaceDetector faceDetector;
    private final OrtEnvironment env;

    private static final class FaceSpec {
        final int size;
        final String template;
        FaceSpec(int size, String template) {
            this.size = size;
            this.template = template;
        }
    }

    private static final class FrameSpec {
        final int tile;
        final int pad;
        final int overlap;
        final int scale;
        FrameSpec(int tile, int pad, int overlap, int scale) {
            this.tile = tile;
            this.pad = pad;
            this.overlap = overlap;
            this.scale = scale;
        }
    }

    public EnhancementProcessor(Context context, FaceDetector faceDetector) {
        this.context = context.getApplicationContext();
        this.faceDetector = faceDetector;
        this.env = OrtEnvironment.getEnvironment();
    }

    public Bitmap apply(Bitmap input) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String faceModel = prefs.getString("face_enhancer_model", "none");
        String frameModel = prefs.getString("frame_enhancer_model", "none");
        Bitmap current = input;

        FaceSpec faceSpec = getFaceSpec(faceModel);
        if (faceSpec != null) {
            File model = new File(context.getFilesDir(), faceModel);
            if (valid(model)) {
                try {
                    Bitmap enhanced = enhanceFaces(current, model, faceSpec);
                    if (enhanced != current) {
                        if (current != input) current.recycle();
                        current = enhanced;
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Face enhancement failed; keeping swap result", t);
                }
            }
        }

        FrameSpec frameSpec = getFrameSpec(frameModel);
        if (frameSpec != null) {
            File model = new File(context.getFilesDir(), frameModel);
            if (valid(model)) {
                try {
                    Bitmap enhanced = enhanceFrame(current, model, frameSpec);
                    if (enhanced != current) {
                        if (current != input) current.recycle();
                        current = enhanced;
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Final enhancement failed; keeping previous result", t);
                }
            }
        }
        return current;
    }

    private boolean valid(File f) {
        return f.exists() && f.length() > 1024 * 1024L;
    }

    private FaceSpec getFaceSpec(String file) {
        if (file == null || "none".equals(file)) return null;
        if ("gpen_bfr_256.onnx".equals(file)) return new FaceSpec(256, "arcface_128");
        if ("gpen_bfr_512.onnx".equals(file)) return new FaceSpec(512, "ffhq_512");
        if ("gpen_bfr_1024.onnx".equals(file)) return new FaceSpec(1024, "ffhq_512");
        if ("gpen_bfr_2048.onnx".equals(file)) return new FaceSpec(2048, "ffhq_512");
        if ("codeformer.onnx".equals(file)
                || "gfpgan_1.2.onnx".equals(file)
                || "gfpgan_1.3.onnx".equals(file)
                || "gfpgan_1.4.onnx".equals(file)
                || "restoreformer_plus_plus.onnx".equals(file)) {
            return new FaceSpec(512, "ffhq_512");
        }
        return null;
    }

    private Bitmap enhanceFaces(Bitmap input, File modelFile, FaceSpec spec) throws Exception {
        List<FaceDetector.Face> faces = faceDetector.detectFaces(input);
        if (faces == null || faces.isEmpty()) return input;

        OrtSession session = null;
        Bitmap result = input.copy(Bitmap.Config.ARGB_8888, true);
        try {
            session = OrtSessionHelper.createSession(env, modelFile.getAbsolutePath(), TAG + "Face");
            for (FaceDetector.Face face : faces) {
                Bitmap aligned = ImageUtils.alignFaceTemplate(result, face.landmarks, spec.template, spec.size);
                Bitmap restored = runFaceEnhancer(session, aligned, spec.size);
                Bitmap blended = ImageUtils.blendFacesTemplate(result, restored, face.landmarks, spec.template, spec.size);
                if (result != input) result.recycle();
                result = blended;
                aligned.recycle();
                restored.recycle();
            }
            return result;
        } catch (Exception e) {
            if (result != input && !result.isRecycled()) result.recycle();
            throw e;
        } finally {
            if (session != null) session.close();
        }
    }

    private Bitmap runFaceEnhancer(OrtSession session, Bitmap face, int size) throws Exception {
        String imageInput = null;
        String weightInput = null;
        TensorInfo imageInfo = null;
        for (Map.Entry<String, NodeInfo> e : session.getInputInfo().entrySet()) {
            TensorInfo info = (TensorInfo) e.getValue().getInfo();
            long[] shape = info.getShape();
            if ("weight".equals(e.getKey())) {
                weightInput = e.getKey();
            } else if (shape.length == 4) {
                imageInput = e.getKey();
                imageInfo = info;
            }
        }
        if (imageInput == null || imageInfo == null) throw new Exception("Face enhancer image input not found");

        float[] data = bitmapToCHW(face, true);
        OnnxTensor imageTensor = createTensor(data, new long[]{1, 3, size, size}, imageInfo.type);
        Map<String, OnnxTensor> inputs = new HashMap<>();
        inputs.put(imageInput, imageTensor);

        OnnxTensor weightTensor = null;
        if (weightInput != null) {
            TensorInfo weightInfo = (TensorInfo) session.getInputInfo().get(weightInput).getInfo();
            if (weightInfo.type == OnnxJavaType.DOUBLE) {
                weightTensor = OnnxTensor.createTensor(env, DoubleBuffer.wrap(new double[]{0.5}), new long[]{1});
            } else if (weightInfo.type == OnnxJavaType.FLOAT16) {
                weightTensor = createTensor(new float[]{0.5f}, new long[]{1}, weightInfo.type);
            } else {
                weightTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(new float[]{0.5f}), new long[]{1});
            }
            inputs.put(weightInput, weightTensor);
        }

        OrtSession.Result results = null;
        try {
            results = session.run(inputs);
            return tensorToBitmap((OnnxTensor) results.get(0), true);
        } finally {
            imageTensor.close();
            if (weightTensor != null) weightTensor.close();
            if (results != null) results.close();
        }
    }

    private FrameSpec getFrameSpec(String file) {
        if ("real_esrgan_x2.onnx".equals(file) || "real_esrgan_x2_fp16.onnx".equals(file))
            return new FrameSpec(256, 16, 8, 2);
        if ("real_esrgan_x4.onnx".equals(file) || "real_esrgan_x4_fp16.onnx".equals(file))
            return new FrameSpec(256, 16, 8, 4);
        if ("ultra_sharp_x4.onnx".equals(file))
            return new FrameSpec(128, 8, 4, 4);
        if ("ultra_sharp_2_x4.onnx".equals(file))
            return new FrameSpec(1024, 64, 32, 4);
        return null;
    }

    private Bitmap enhanceFrame(Bitmap source, File modelFile, FrameSpec spec) throws Exception {
        Bitmap input = source;
        int maxInput = spec.scale >= 4 ? 1024 : 1536;
        if (Math.max(source.getWidth(), source.getHeight()) > maxInput) {
            input = ImageUtils.resizeImage(source, maxInput);
        }

        OrtSession session = null;
        try {
            session = OrtSessionHelper.createSession(env, modelFile.getAbsolutePath(), TAG + "Frame");
            String inputName = null;
            TensorInfo inputInfo = null;
            for (Map.Entry<String, NodeInfo> e : session.getInputInfo().entrySet()) {
                TensorInfo info = (TensorInfo) e.getValue().getInfo();
                if (info.getShape().length == 4) {
                    inputName = e.getKey();
                    inputInfo = info;
                    break;
                }
            }
            if (inputName == null || inputInfo == null) throw new Exception("Frame enhancer input not found");

            int tileInner = spec.tile - 2 * spec.overlap;
            int padTop = spec.pad + spec.overlap;
            int paddedInputH = input.getHeight() + 2 * spec.pad;
            int paddedInputW = input.getWidth() + 2 * spec.pad;
            int remH = paddedInputH % tileInner;
            int remW = paddedInputW % tileInner;
            int padBottom = padTop + (remH == 0 ? 0 : tileInner - remH);
            int padRight = padTop + (remW == 0 ? 0 : tileInner - remW);
            int paddedW = input.getWidth() + padTop + padRight;
            int paddedH = input.getHeight() + padTop + padBottom;

            Bitmap padded = Bitmap.createBitmap(paddedW, paddedH, Bitmap.Config.ARGB_8888);
            Canvas padCanvas = new Canvas(padded);
            padCanvas.drawColor(0xFF000000);
            padCanvas.drawBitmap(input, padTop, padTop, new Paint(Paint.FILTER_BITMAP_FLAG));

            Bitmap merged = Bitmap.createBitmap(paddedW * spec.scale, paddedH * spec.scale, Bitmap.Config.ARGB_8888);
            Canvas mergeCanvas = new Canvas(merged);
            Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG);

            int rowIndex = 0;
            for (int row = spec.overlap; row < paddedH - spec.overlap; row += tileInner) {
                int colIndex = 0;
                int top = row - spec.overlap;
                for (int col = spec.overlap; col < paddedW - spec.overlap; col += tileInner) {
                    int left = col - spec.overlap;
                    if (left + spec.tile > paddedW || top + spec.tile > paddedH) continue;
                    Bitmap tile = Bitmap.createBitmap(padded, left, top, spec.tile, spec.tile);
                    Bitmap up = runFrameTile(session, inputName, inputInfo, tile, spec.scale);
                    tile.recycle();
                    int crop = spec.overlap * spec.scale;
                    int innerOut = tileInner * spec.scale;
                    Bitmap inner = Bitmap.createBitmap(up, crop, crop, innerOut, innerOut);
                    mergeCanvas.drawBitmap(inner, colIndex * innerOut, rowIndex * innerOut, paint);
                    inner.recycle();
                    up.recycle();
                    colIndex++;
                }
                rowIndex++;
            }
            padded.recycle();

            int cropLeft = spec.pad * spec.scale;
            int cropTop = spec.pad * spec.scale;
            int outW = input.getWidth() * spec.scale;
            int outH = input.getHeight() * spec.scale;
            Bitmap enhanced = Bitmap.createBitmap(merged, cropLeft, cropTop, outW, outH);
            merged.recycle();

            Bitmap base = Bitmap.createScaledBitmap(input, outW, outH, true);
            Bitmap blended = base.copy(Bitmap.Config.ARGB_8888, true);
            Canvas c = new Canvas(blended);
            Paint blendPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
            blendPaint.setAlpha(204);
            c.drawBitmap(enhanced, 0, 0, blendPaint);
            enhanced.recycle();
            base.recycle();
            if (input != source) input.recycle();
            return blended;
        } finally {
            if (session != null) session.close();
        }
    }

    private Bitmap runFrameTile(OrtSession session, String inputName, TensorInfo inputInfo,
                                Bitmap tile, int scale) throws Exception {
        int size = tile.getWidth();
        float[] data = bitmapToCHW(tile, false);
        OnnxTensor inputTensor = createTensor(data, new long[]{1, 3, size, size}, inputInfo.type);
        OrtSession.Result results = null;
        try {
            Map<String, OnnxTensor> inputs = new HashMap<>();
            inputs.put(inputName, inputTensor);
            results = session.run(inputs);
            Bitmap out = tensorToBitmap((OnnxTensor) results.get(0), false);
            int expected = size * scale;
            if (out.getWidth() != expected || out.getHeight() != expected) {
                Bitmap resized = Bitmap.createScaledBitmap(out, expected, expected, true);
                out.recycle();
                out = resized;
            }
            return out;
        } finally {
            inputTensor.close();
            if (results != null) results.close();
        }
    }

    private float[] bitmapToCHW(Bitmap bitmap, boolean minusOneToOne) {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        int[] pixels = new int[w * h];
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h);
        float[] output = new float[pixels.length * 3];
        int plane = pixels.length;
        for (int i = 0; i < pixels.length; i++) {
            int p = pixels[i];
            float r = ((p >> 16) & 0xFF) / 255.0f;
            float g = ((p >> 8) & 0xFF) / 255.0f;
            float b = (p & 0xFF) / 255.0f;
            if (minusOneToOne) {
                r = (r - 0.5f) / 0.5f;
                g = (g - 0.5f) / 0.5f;
                b = (b - 0.5f) / 0.5f;
            }
            output[i] = r;
            output[plane + i] = g;
            output[2 * plane + i] = b;
        }
        return output;
    }

    private OnnxTensor createTensor(float[] values, long[] shape, OnnxJavaType type) throws Exception {
        if (type == OnnxJavaType.FLOAT16) {
            ByteBuffer bytes = ByteBuffer.allocateDirect(values.length * 2).order(ByteOrder.nativeOrder());
            for (float v : values) bytes.putShort(floatToHalf(v));
            bytes.rewind();
            return OnnxTensor.createTensor(env, bytes, shape, OnnxJavaType.FLOAT16);
        }
        return OnnxTensor.createTensor(env, FloatBuffer.wrap(values), shape);
    }

    private Bitmap tensorToBitmap(OnnxTensor tensor, boolean minusOneToOne) throws Exception {
        TensorInfo info = tensor.getInfo();
        long[] shape = info.getShape();
        if (shape.length != 4 || shape[0] != 1 || shape[1] < 3) throw new Exception("Unsupported enhancer output shape");
        int h = (int) shape[2];
        int w = (int) shape[3];
        int plane = h * w;
        float[] data = new float[plane * 3];

        if (info.type == OnnxJavaType.FLOAT16) {
            ShortBuffer sb = tensor.getShortBuffer();
            if (sb == null) throw new Exception("Unable to read FP16 output");
            for (int i = 0; i < data.length; i++) data[i] = halfToFloat(sb.get(i));
        } else {
            FloatBuffer fb = tensor.getFloatBuffer();
            if (fb == null) throw new Exception("Unable to read float output");
            for (int i = 0; i < data.length; i++) data[i] = fb.get(i);
        }

        int[] pixels = new int[plane];
        for (int i = 0; i < plane; i++) {
            float r = data[i];
            float g = data[plane + i];
            float b = data[2 * plane + i];
            if (minusOneToOne) {
                r = (r + 1.0f) * 0.5f;
                g = (g + 1.0f) * 0.5f;
                b = (b + 1.0f) * 0.5f;
            }
            int ri = clamp255(Math.round(r * 255.0f));
            int gi = clamp255(Math.round(g * 255.0f));
            int bi = clamp255(Math.round(b * 255.0f));
            pixels[i] = 0xFF000000 | (ri << 16) | (gi << 8) | bi;
        }
        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        out.setPixels(pixels, 0, w, 0, 0, w, h);
        return out;
    }

    private int clamp255(int v) { return Math.max(0, Math.min(255, v)); }

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
}
