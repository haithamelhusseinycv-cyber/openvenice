package ai.openvenice.app;

import android.app.Instrumentation;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Exercises the actual release OpenVenice UID across the companion IPC boundary. */
public final class FaceFusionBridgeSmoke extends Instrumentation {
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
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
            report.putString("stream", "\nFACEFUSION_BRIDGE_SMOKE_PASS\n"
                    + payload[0] + "\n" + payload[1]);
            finish(-1, report);
        } catch (Throwable failure) {
            report.putString("stream", "\nFACEFUSION_BRIDGE_SMOKE_FAIL\n" + failure);
            finish(1, report);
        } finally {
            if (bound) context.unbindService(connection);
            receiver.quitSafely();
        }
    }
}
