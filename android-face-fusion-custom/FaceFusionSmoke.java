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
            {
            AgentBridgeService service = new AgentBridgeService();
            java.lang.reflect.Method attach = android.content.ContextWrapper.class.getDeclaredMethod("attachBaseContext", Context.class);
            attach.setAccessible(true); attach.invoke(service, context);
            java.lang.reflect.Method save = AgentBridgeService.class.getDeclaredMethod("saveOutput", Bitmap.class, int.class, String.class);
            java.lang.reflect.Method release = AgentBridgeService.class.getDeclaredMethod("releaseOutput", String.class, int.class);
            java.lang.reflect.Method sweep = AgentBridgeService.class.getDeclaredMethod("sweepOutputs", File.class);
            save.setAccessible(true); release.setAccessible(true); sweep.setAccessible(true);
            Bitmap tiny=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);
            android.net.Uri saved=(android.net.Uri)save.invoke(service,tiny,android.os.Process.myUid(),"cleanup-smoke");
            tiny.recycle();
            File dir=new File(context.getCacheDir(),"shared_images");
            File savedFile=new File(dir,saved.getLastPathSegment());
            if(!savedFile.exists())throw new Exception("Output cleanup fixture missing");
            release.invoke(service,saved.toString(),-1);
            if(!savedFile.exists())throw new Exception("Wrong caller could delete an output");
            release.invoke(service,saved.toString(),android.os.Process.myUid());
            if(savedFile.exists())throw new Exception("Acknowledged output was not deleted");
            File stale=new File(dir,"agent-stale-smoke.jpg");stale.createNewFile();stale.setLastModified(1);
            sweep.invoke(service,dir);
            if(stale.exists())throw new Exception("Stale output survived sweep");
            for(int i=0;i<4;i++) {
                try(java.io.RandomAccessFile file=new java.io.RandomAccessFile(new File(dir,"agent-quota-smoke-"+i+".jpg"),"rw")) { file.setLength(16L*1024*1024); }
            }
            sweep.invoke(service,dir);
            long retained=0;for(File f:dir.listFiles())if(f.getName().startsWith("agent-"))retained+=f.length();
            if(retained>48L*1024*1024)throw new Exception("Output quota was exceeded");
            for(File f:dir.listFiles())if(f.getName().startsWith("agent-quota-smoke-"))f.delete();
            System.out.println("OUTPUT_ACK_OWNER_CHECK_PASS OUTPUT_STALE_SWEEP_PASS OUTPUT_QUOTA_PASS");
            }
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
