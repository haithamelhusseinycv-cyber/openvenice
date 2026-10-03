package com.pv.androidfacefusion;

import android.app.Instrumentation;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import org.json.JSONObject;

public class FaceFusionSmoke extends Instrumentation {
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    @Override public void onStart() {
        Bundle report = new Bundle();
        FaceDetector detector = null;
        FaceEmbedder embedder = null;
        FaceSwapper swapper = null;
        long start = android.os.SystemClock.elapsedRealtime();
        try {
            Context context = getTargetContext();
            Bitmap source, target;
            try (InputStream in = getContext().getAssets().open("grace_hopper.jpg")) {
                source = BitmapFactory.decodeStream(in);
            }
            try (InputStream in = getContext().getAssets().open("astronaut.png")) {
                target = BitmapFactory.decodeStream(in);
            }
            if (source == null || target == null) throw new Exception("Test images failed to decode");
            detector = new FaceDetector(context);
            detector.initialize();
            int sources = detector.detectFaces(source).size();
            int targets = detector.detectFaces(target).size();
            if (sources < 1 || targets < 1) throw new Exception("Sample face detection failed");
            embedder = new FaceEmbedder(context);
            embedder.initialize();
            swapper = new FaceSwapper(context);
            swapper.initialize();
            FaceFusionProcessor processor = new FaceFusionProcessor(detector, embedder, swapper);
            Bitmap result = processor.processFaceFusion(source, target, 0);
            if (result.getWidth() != target.getWidth() || result.getHeight() != target.getHeight())
                throw new Exception("Swap unexpectedly changed image dimensions");
            int changed = 0;
            for (int y = 0; y < target.getHeight(); y++)
                for (int x = 0; x < target.getWidth(); x++)
                    if (target.getPixel(x, y) != result.getPixel(x, y)) changed++;
            if (changed < 100) throw new Exception("Swap returned an unchanged image");
            File dir = new File(context.getCacheDir(), "facefusion-smoke");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create test output directory");
            save(result, new File(dir, "swap.png"));
            Bitmap enhanced = new EnhancementProcessor(context, detector).apply(result);
            File output = new File(dir, "enhanced.png");
            save(enhanced, output);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(output.getAbsolutePath(), bounds);
            if (bounds.outWidth != enhanced.getWidth() || bounds.outHeight != enhanced.getHeight())
                throw new Exception("Saved image dimensions differ from output");
            JSONObject data = new JSONObject();
            data.put("sourceFaces", sources);
            data.put("targetFaces", targets);
            data.put("swapper", swapper.getSelectedModel());
            data.put("changedPixels", changed);
            data.put("swapWidth", result.getWidth());
            data.put("swapHeight", result.getHeight());
            data.put("outputWidth", enhanced.getWidth());
            data.put("outputHeight", enhanced.getHeight());
            data.put("elapsedMs", android.os.SystemClock.elapsedRealtime() - start);
            data.put("output", output.getAbsolutePath());
            data.put("status", "passed");
            try (FileOutputStream out = new FileOutputStream(new File(dir, "result.json"))) {
                out.write(data.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            report.putString("stream", "\nFACEFUSION_SMOKE_PASS\n" + data.toString(2));
            finish(-1, report);
        } catch (Throwable e) {
            report.putString("stream", "\nFACEFUSION_SMOKE_FAIL\n" + android.util.Log.getStackTraceString(e));
            finish(1, report);
        } finally {
            if (swapper != null) swapper.close();
            if (embedder != null) embedder.close();
            if (detector != null) detector.close();
        }
    }
    private void save(Bitmap image, File file) throws Exception {
        try (FileOutputStream out = new FileOutputStream(file)) {
            if (!image.compress(Bitmap.CompressFormat.PNG, 100, out))
                throw new Exception("PNG encoding failed");
        }
    }
}
