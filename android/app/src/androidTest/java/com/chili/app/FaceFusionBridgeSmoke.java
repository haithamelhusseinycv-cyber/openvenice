package com.chili.app;

import android.app.Instrumentation;
import com.getcapacitor.*;
import android.net.Uri;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Exercises the actual release OpenVenice UID across the companion IPC boundary. */
public final class FaceFusionBridgeSmoke extends Instrumentation {
    static final class ResultCall extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1); JSObject result; String failure;
        ResultCall(String plugin, String method, JSObject data) { super(null, plugin, "release-smoke", method, data); }
        @Override public void resolve(JSObject data) { result=data; done.countDown(); }
        @Override public void resolve() { result=new JSObject(); done.countDown(); }
        @Override public void reject(String msg,String code,Exception ex,JSObject data) { failure=msg; done.countDown(); }
        JSObject await() throws Exception { if(!done.await(90,TimeUnit.SECONDS))throw new Exception("Native call timed out: "+getMethodName()); if(failure!=null)throw new Exception(failure); return result; }
    }
    private JSObject invoke(Bridge bridge,String plugin,String method,JSObject data) throws Exception {
        PluginHandle handle=bridge.getPlugin(plugin); if(handle==null)throw new Exception("Plugin missing: "+plugin);
        ResultCall call=new ResultCall(plugin,method,data);
        handle.getInstance().getClass().getMethod(method,PluginCall.class).invoke(handle.getInstance(),call);
        return call.await();
    }
    private String nativeChecks() throws Exception {
        Intent intent=new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        BridgeActivity activity=(BridgeActivity)startActivitySync(intent); Bridge bridge=activity.getBridge();
        JSObject data=new JSObject(); data.put("name","release-smoke"); data.put("value","release-roundtrip");
        invoke(bridge,"AuthVault","saveNamed",data);
        String stored=getTargetContext().getSharedPreferences("chilli-vault",Context.MODE_PRIVATE).getString("release-smoke","");
        if(stored.contains("release-roundtrip")||stored.isEmpty())throw new Exception("Vault did not encrypt");
        JSObject loaded=invoke(bridge,"AuthVault","loadNamed",data);
        if(!"release-roundtrip".equals(loaded.getString("value")))throw new Exception("Vault roundtrip failed");
        invoke(bridge,"AuthVault","clearNamed",data);
        if(invoke(bridge,"AuthVault","loadNamed",data).optBoolean("found",true))throw new Exception("Vault clear failed");
        JSObject image=new JSObject();
        image.put("imageUri","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fAAAAABJRU5ErkJggg==");
        image.put("mimeType","image/png"); image.put("fileName","chilli-release-smoke.png");
        Uri uri=Uri.parse(invoke(bridge,"MediaActions","saveImage",image).getString("uri"));
        try(java.io.InputStream in=getTargetContext().getContentResolver().openInputStream(uri)) { if(in==null||in.read()<0)throw new Exception("Saved media unreadable"); }
        getTargetContext().getContentResolver().delete(uri,null,null);
        JSObject voice=invoke(bridge,"VoiceChat","isAvailable",new JSObject());
        if (testHardening) {
            Object plugin = bridge.getPlugin("FaceFusionAgent").getInstance();
            java.lang.reflect.Field remote=plugin.getClass().getDeclaredField("serviceMessenger");
            java.lang.reflect.Field bound=plugin.getClass().getDeclaredField("bound");
            java.lang.reflect.Field timeout=plugin.getClass().getDeclaredField("controlTimeoutMs");
            remote.setAccessible(true);bound.setAccessible(true);timeout.setAccessible(true);
            HandlerThread silent=new HandlerThread("SilentCompanion");silent.start();
            remote.set(plugin,new Messenger(new Handler(silent.getLooper())));bound.setBoolean(plugin,true);
            timeout.setLong(plugin,500);
            long began=SystemClock.elapsedRealtime();
            try { invoke(bridge,"FaceFusionAgent","ping",new JSObject()); throw new Exception("Silent companion unexpectedly succeeded"); }
            catch (Exception expected) { if(!expected.getMessage().contains("timed out"))throw expected; }
            if(SystemClock.elapsedRealtime()-began>5000)throw new Exception("Native deadline did not settle promptly");
            timeout.setLong(plugin,10000);silent.quitSafely();
            if(invoke(bridge,"FaceFusionAgent","ping",new JSObject()).getInt("protocol")!=1)throw new Exception("Deadline recovery failed");
            HandlerThread cancelled=new HandlerThread("CancelledCompanion");cancelled.start();
            CountDownLatch sent=new CountDownLatch(1);
            remote.set(plugin,new Messenger(new Handler(cancelled.getLooper()) {
                @Override public void handleMessage(Message message) { if(message.what==2)sent.countDown(); }
            }));
            ResultCall interrupted=new ResultCall("FaceFusionAgent","detectFaces",image);
            plugin.getClass().getMethod("detectFaces",PluginCall.class).invoke(plugin,interrupted);
            if(!sent.await(5,TimeUnit.SECONDS))throw new Exception("Cancellation fixture did not dispatch");
            invoke(bridge,"FaceFusionAgent","cancel",new JSObject());
            try { interrupted.await();throw new Exception("Cancelled request succeeded"); }
            catch(Exception expected){if(!expected.getMessage().contains("cancelled"))throw expected;}
            java.lang.reflect.Field jobDeadline=plugin.getClass().getDeclaredField("jobTimeoutMs");
            jobDeadline.setAccessible(true);jobDeadline.setLong(plugin,500);
            try { invoke(bridge,"FaceFusionAgent","detectFaces",image);throw new Exception("Silent image job succeeded"); }
            catch(Exception expected){if(!expected.getMessage().contains("timed out"))throw expected;}
            jobDeadline.setLong(plugin,180000);cancelled.quitSafely();
            if(invoke(bridge,"FaceFusionAgent","ping",new JSObject()).getInt("protocol")!=1)throw new Exception("Image deadline recovery failed");
            java.lang.reflect.Field workerField=plugin.getClass().getDeclaredField("imageWorker");workerField.setAccessible(true);
            java.util.concurrent.ExecutorService worker=(java.util.concurrent.ExecutorService)workerField.get(plugin);
            CountDownLatch blocked=new CountDownLatch(1), releaseWorker=new CountDownLatch(1);
            worker.execute(() -> { blocked.countDown();try { releaseWorker.await(); } catch(InterruptedException ex) { Thread.currentThread().interrupt(); } });
            if(!blocked.await(5,TimeUnit.SECONDS))throw new Exception("Preparation blocker failed");
            ResultCall preparingCall=new ResultCall("FaceFusionAgent","detectFaces",image);
            plugin.getClass().getMethod("detectFaces",PluginCall.class).invoke(plugin,preparingCall);
            invoke(bridge,"FaceFusionAgent","cancel",new JSObject());
            try { preparingCall.await();throw new Exception("Preparation cancellation succeeded unexpectedly"); }
            catch(Exception expected){if(!expected.getMessage().contains("cancelled"))throw expected;}
            finally { releaseWorker.countDown(); }
            android.graphics.Bitmap big=android.graphics.Bitmap.createBitmap(3000,3000,android.graphics.Bitmap.Config.ARGB_8888);
            java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
            big.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);big.recycle();
            JSObject invalid=new JSObject();invalid.put("imageUri","data:image/png;base64,"+android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP));
            try { invoke(bridge,"FaceFusionAgent","detectFaces",invalid);throw new Exception("Oversized image was accepted"); }
            catch(Exception expected){if(!expected.getMessage().contains("megapixels"))throw expected;}
            java.io.File[] leftovers=new java.io.File(getTargetContext().getCacheDir(),"agent_inputs").listFiles();
            if(leftovers!=null&&leftovers.length!=0)throw new Exception("Input cleanup left "+leftovers.length+" files");
        }
        String processing = "";
        if (testProcessing) {
            byte[] sourceBytes, targetBytes;
            try (java.io.InputStream in=getContext().getAssets().open("grace_hopper.jpg")) { sourceBytes=readBytes(in); }
            try (java.io.InputStream in=getContext().getAssets().open("astronaut.png")) { targetBytes=readBytes(in); }
            JSObject job=new JSObject();
            job.put("sourceUri","data:image/jpeg;base64,"+android.util.Base64.encodeToString(sourceBytes,android.util.Base64.NO_WRAP));
            job.put("targetUri","data:image/png;base64,"+android.util.Base64.encodeToString(targetBytes,android.util.Base64.NO_WRAP));
            JSObject result=invoke(bridge,"FaceFusionAgent","swap",job);
            byte[] encoded=android.util.Base64.decode(result.getString("image"),android.util.Base64.DEFAULT);
            android.graphics.Bitmap output=android.graphics.BitmapFactory.decodeByteArray(encoded,0,encoded.length);
            android.graphics.Bitmap target=android.graphics.BitmapFactory.decodeByteArray(targetBytes,0,targetBytes.length);
            if(output==null||output.getWidth()!=target.getWidth()||output.getHeight()!=target.getHeight())throw new Exception("Chilli swap result dimensions invalid");
            int changed=0;
            for(int y=0;y<target.getHeight();y++)for(int x=0;x<target.getWidth();x++)if(output.getPixel(x,y)!=target.getPixel(x,y))changed++;
            if(changed<100)throw new Exception("Chilli swap returned unchanged image");
            processing=" CHILLI_FACEFUSION_PROCESSING_PASS pixels="+changed+" size="+output.getWidth()+"x"+output.getHeight();
            output.recycle();target.recycle();
            if (testRecovery) {
                java.io.File dir=getTargetContext().getExternalFilesDir(null);
                java.io.File ready=new java.io.File(dir,"facefusion-recovery-ready");
                java.io.File killed=new java.io.File(dir,"facefusion-recovery-killed");
                killed.delete();ready.createNewFile();
                long until=SystemClock.elapsedRealtime()+60000;
                while(!killed.exists()&&SystemClock.elapsedRealtime()<until)Thread.sleep(200);
                ready.delete();
                if(!killed.exists())throw new Exception("Companion kill checkpoint was not reached");
                Thread.sleep(500);
                JSObject ping=invoke(bridge,"FaceFusionAgent","ping",new JSObject());
                if(ping.getInt("protocol")!=1)throw new Exception("Companion reconnect failed");
                JSObject retry=invoke(bridge,"FaceFusionAgent","swap",job);
                if(retry.getString("image")==null)throw new Exception("Companion processing after reconnect failed");
                processing+=" CHILLI_FACEFUSION_KILL_RECONNECT_PASS";
                killed.delete();
            }
        }
        if (testHardening) {
            java.io.File[] files=new java.io.File(getTargetContext().getCacheDir(),"agent_inputs").listFiles();
            if(files!=null&&files.length!=0)throw new Exception("Completed-job input files remain");
            processing+=" SILENT_DEADLINE_RECOVERY_PASS IMAGE_DEADLINE_RECOVERY_PASS NATIVE_CANCEL_PASS PREPARATION_CANCEL_PASS OVERSIZE_REJECTION_PASS INPUT_CLEANUP_PASS";
        }
        return "VAULT_ENCRYPTED_ROUNDTRIP_PASS MEDIASTORE_SAVE_PASS VOICE_AVAILABILITY "+voice.toString()+processing;
    }
    private static byte[] readBytes(java.io.InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
        byte[] buffer=new byte[8192];int n;
        while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
        return out.toByteArray();
    }
    private boolean testProcessing;
    private boolean testRecovery;
    private boolean testHardening;
    @Override public void onCreate(Bundle args) { super.onCreate(args); testHardening = args != null && "true".equals(args.getString("hardening")); testProcessing = args != null && "true".equals(args.getString("processing")); testRecovery = args != null && "true".equals(args.getString("recovery")); start(); }
    @Override public void onStart() {
        Bundle report = new Bundle();
        HandlerThread receiver = new HandlerThread("BridgeSmokeReplies");
        receiver.start();
        Context context = getTargetContext();
        CountDownLatch complete = new CountDownLatch(1);
        final String[] error = new String[1];
        final String[] payload = new String[2];
        final Messenger[] remote = new Messenger[1];
        Messenger replies = new Messenger(new Handler(receiver.getLooper()) {
            @Override public void handleMessage(Message message) {
                try {
                    Bundle data = message.getData();
                    if (!data.getBoolean("ok")) throw new Exception(data.getString("error"));
                    JSONObject result = new JSONObject(data.getString("json"));
                    if (message.what == 6) {
                        if (result.getInt("protocol") != 1) throw new Exception("Unexpected protocol");
                        payload[0] = result.toString();
                        send(remote[0], 1);
                    } else if (message.what == 1) {
                        if (!result.has("selected") || !result.has("swappers"))
                            throw new Exception("Incomplete model catalog");
                        payload[1] = result.toString();
                        complete.countDown();
                    } else throw new Exception("Unexpected reply");
                } catch (Throwable failure) {
                    error[0] = failure.toString();
                    complete.countDown();
                }
            }
            private void send(Messenger service, int command) throws RemoteException {
                Message request = Message.obtain(null, command);
                request.replyTo = new Messenger(this);
                Bundle data = new Bundle();
                data.putString("requestId", "bridge-smoke-" + command);
                request.setData(data);
                service.send(request);
            }
        });
        ServiceConnection connection = new ServiceConnection() {
            @Override public void onServiceConnected(ComponentName name, IBinder binder) {
                try {
                    remote[0] = new Messenger(binder);
                    Message ping = Message.obtain(null, 6);
                    ping.replyTo = replies;
                    Bundle data = new Bundle();
                    data.putString("requestId", "bridge-smoke-6");
                    ping.setData(data);
                    remote[0].send(ping);
                } catch (Throwable failure) { error[0] = failure.toString(); complete.countDown(); }
            }
            @Override public void onServiceDisconnected(ComponentName name) {}
        };
        boolean bound = false;
        try {
            report.putString("native", nativeChecks());
            String permission = "ai.openvenice.permission.FACEFUSION_AGENT";
            if (context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED)
                throw new Exception("OpenVenice companion permission is not granted");
            if (context.checkPermission(permission, -1, 2000) == PackageManager.PERMISSION_GRANTED)
                throw new Exception("Untrusted shell UID unexpectedly has companion permission");
            Intent intent = new Intent().setComponent(new ComponentName(
                    "com.pv.androidfacefusion", "com.pv.androidfacefusion.AgentBridgeService"));
            bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
            if (!bound) throw new Exception("Companion did not bind");
            if (!complete.await(30, TimeUnit.SECONDS)) throw new Exception("Companion IPC timed out");
            if (error[0] != null) throw new Exception(error[0]);
            report.putString("stream", "\n"+report.getString("native","")+"\nFACEFUSION_BRIDGE_SMOKE_PASS\n"
                    + payload[0] + "\n" + payload[1]);
            finish(-1, report);
        } catch (Throwable failure) {
            report.putString("stream", "\n"+report.getString("native","")+"\nFACEFUSION_BRIDGE_SMOKE_FAIL\n" + failure);
            finish(1, report);
        } finally {
            if (bound) context.unbindService(connection);
            receiver.quitSafely();
        }
    }
}
