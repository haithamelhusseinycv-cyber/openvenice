package com.pv.androidfacefusion;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Phone-loopback transport for Chilli's installed PWA. */
final class PwaBridgeServer implements AutoCloseable {
    private static final Set<String> ORIGINS = new HashSet<>(Arrays.asList(
        "https://localhost",
        "https://chilli-production.haitham-elhusseiny-cv.workers.dev",
        "https://chilli-staging.haitham-elhusseiny-cv.workers.dev"));
    private static final Set<String> ROUTES = new HashSet<>(Arrays.asList(
        "/health", "/models", "/detect", "/swap", "/enhance", "/cancel"));
    private static final int MAX_BODY = 46 * 1024 * 1024;
    private final AgentBridgeService service;
    private final ServerSocket socket;
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(
        2, 4, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(8));
    private volatile boolean closed;

    PwaBridgeServer(AgentBridgeService service) throws IOException {
        this.service = service;
        socket = new ServerSocket();
        socket.setReuseAddress(true);
        socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 8810));
        Thread listener = new Thread(() -> {
            while (!closed) {
                try {
                    Socket client = socket.accept();
                    try { workers.execute(() -> handle(client)); }
                    catch (RejectedExecutionException e) { client.close(); }
                } catch (IOException e) { if (!closed) android.util.Log.w("ChilliPwa", "Listener stopped"); }
            }
        }, "Chilli-PWA-listener");
        listener.setDaemon(true);
        listener.start();
    }

    private static String line(InputStream in) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int value;
        while ((value = in.read()) != -1) {
            if (value == 10) return bytes.toString("US-ASCII").replace("\r", "");
            if (bytes.size() >= 8192) throw new IOException("Header too long");
            bytes.write(value);
        }
        throw new EOFException();
    }

    private void handle(Socket client) {
        String origin = null;
        try (Socket connection = client) {
            connection.setSoTimeout(30_000);
            BufferedInputStream in = new BufferedInputStream(connection.getInputStream());
            String[] start = line(in).split(" ");
            if (start.length != 3) { send(connection, 400, null, new JSONObject()); return; }
            String method = start[0], path = start[1];
            Map<String, String> headers = new HashMap<>();
            int size = 0;
            while (true) {
                String header = line(in);
                if (header.isEmpty()) break;
                size += header.length();
                if (size > 32768) throw new IOException("Headers too long");
                int colon = header.indexOf(':');
                if (colon <= 0) throw new IOException("Invalid header");
                String key = header.substring(0, colon).trim().toLowerCase(Locale.ROOT);
                if (headers.containsKey(key)) throw new IOException("Duplicate header");
                headers.put(key, header.substring(colon + 1).trim());
            }
            origin = headers.get("origin");
            if (!ORIGINS.contains(origin)) {
                send(connection, 403, null, new JSONObject().put("error", "Origin not allowed")); return;
            }
            if (!ROUTES.contains(path)) { send(connection, 404, origin, new JSONObject()); return; }
            if ("OPTIONS".equals(method)) { send(connection, 204, origin, new JSONObject()); return; }
            if ("GET".equals(method) && "/health".equals(path)) {
                send(connection, 200, origin, new JSONObject().put("status", "healthy").put("protocol", 1).put("engine", "android-facefusion")); return;
            }
            if (!("GET".equals(method) && "/models".equals(path)) && !("POST".equals(method) && !"/models".equals(path) && !"/health".equals(path))) {
                send(connection, 405, origin, new JSONObject()); return;
            }
            if (headers.containsKey("transfer-encoding")) throw new IOException("Chunked body not supported");
            int length;
            try { length = Integer.parseInt(headers.getOrDefault("content-length", "0")); }
            catch (NumberFormatException e) { send(connection, 400, origin, new JSONObject()); return; }
            if (length < 0 || length > MAX_BODY) { send(connection, 413, origin, new JSONObject().put("error", "Image request is too large")); return; }
            byte[] body = new byte[length];
            int offset = 0;
            while (offset < length) {
                int count = in.read(body, offset, length - offset);
                if (count < 0) throw new EOFException();
                offset += count;
            }
            if ("POST".equals(method) && !headers.getOrDefault("content-type", "").startsWith("application/json")) {
                send(connection, 415, origin, new JSONObject()); return;
            }
            JSONObject request = length == 0 ? new JSONObject() : new JSONObject(new String(body, StandardCharsets.UTF_8));
            try {
                JSONObject result = service.browserRequest(path, request);
                send(connection, 200, origin, result);
            } catch (TimeoutException e) {
                send(connection, 504, origin, new JSONObject().put("error", "FaceFusion timed out. Retry the operation."));
            } catch (IllegalStateException e) {
                send(connection, 409, origin, new JSONObject().put("error", e.getMessage()));
            } catch (Exception e) {
                Throwable cause = e instanceof ExecutionException && e.getCause() != null ? e.getCause() : e;
                send(connection, 400, origin, new JSONObject().put("error", cause.getMessage() == null ? "FaceFusion failed" : cause.getMessage()));
            }
        } catch (Exception ignored) { /* Disconnects never log photos or payloads. */ }
    }

    private static void send(Socket client, int code, String origin, JSONObject data) throws IOException {
        byte[] body = code == 204 ? new byte[0] : data.toString().getBytes(StandardCharsets.UTF_8);
        StringBuilder headers = new StringBuilder("HTTP/1.1 ").append(code).append(" Response\r\n")
            .append("Content-Type: application/json\r\nContent-Length: ").append(body.length)
            .append("\r\nConnection: close\r\nCache-Control: no-store\r\n");
        if (ORIGINS.contains(origin)) headers.append("Access-Control-Allow-Origin: ").append(origin)
            .append("\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
            .append("Access-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\n");
        headers.append("\r\n");
        OutputStream out = client.getOutputStream();
        out.write(headers.toString().getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    @Override public void close() {
        closed = true;
        try { socket.close(); } catch (IOException ignored) {}
        workers.shutdownNow();
    }
}
