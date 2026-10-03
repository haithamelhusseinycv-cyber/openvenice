#!/data/data/com.termux/files/usr/bin/python
"""Loopback-only browser transport for the existing Local Dream Android host."""
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import requests

ALLOWED_ORIGINS = frozenset({"https://localhost"})
MAX_BODY = 128 * 1024 * 1024
CONTROL_ROUTES = frozenset({"/info", "/models", "/status", "/select", "/stop"})
GENERATION_ROUTES = frozenset({"/health", "/generate", "/upscale"})
HOP_HEADERS = frozenset({"connection", "keep-alive", "transfer-encoding", "upgrade",
                         "proxy-authenticate", "proxy-authorization", "te", "trailer",
                         "content-length", "content-encoding", "access-control-allow-origin"})

def handler_for(upstream_port, routes):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.0"

        def log_message(self, *_args):
            pass  # Do not log prompts, images, or private request metadata.

        def origin_allowed(self):
            origin = self.headers.get("Origin")
            return origin is None or origin in ALLOWED_ORIGINS

        def cors_headers(self):
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Image-Width, X-Image-Height, X-Upscaler-Path, X-Use-OpenCL")
                self.send_header("Access-Control-Expose-Headers", "X-Output-Width, X-Output-Height, X-Duration-MS")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Cache-Control", "no-store")

        def error(self, status, message):
            body = message.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.cors_headers()
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            if not self.origin_allowed():
                return self.error(403, "Origin is not allowed")
            if urlsplit(self.path).path not in routes:
                return self.error(404, "Unknown Local Dream endpoint")
            self.send_response(204)
            self.cors_headers()
            self.end_headers()

        def do_GET(self):
            self.forward()

        def do_POST(self):
            self.forward()

        def forward(self):
            if not self.origin_allowed():
                return self.error(403, "Origin is not allowed")
            path = urlsplit(self.path)
            if path.path not in routes:
                return self.error(404, "Unknown Local Dream endpoint")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.error(400, "Invalid content length")
            if length < 0 or length > MAX_BODY:
                return self.error(413, "Image request is too large")
            self.connection.settimeout(30)
            body = self.rfile.read(length) if length else None
            if length and len(body) != length:
                return self.error(400, "Incomplete request")
            headers = {"Accept-Encoding": "identity"}
            if self.headers.get("Content-Type"):
                headers["Content-Type"] = self.headers["Content-Type"]
            for key in ("X-Image-Width", "X-Image-Height", "X-Upscaler-Path", "X-Use-OpenCL"):
                if self.headers.get(key):
                    headers[key] = self.headers[key]
            upstream_path = path.path + ("?" + path.query if path.query else "")
            started = False
            try:
                with requests.request(
                    self.command, f"http://127.0.0.1:{upstream_port}{upstream_path}",
                    data=body, headers=headers, stream=True, timeout=(5, 600),
                    allow_redirects=False,
                ) as response:
                    self.send_response(response.status_code)
                    for key, value in response.headers.items():
                        if key.lower() not in HOP_HEADERS:
                            self.send_header(key, value)
                    self.cors_headers()
                    self.end_headers()
                    started = True
                    chunk_size = 128 if response.headers.get("Content-Type", "").startswith("text/event-stream") else 64 * 1024
                    for chunk in response.iter_content(chunk_size=chunk_size):
                        if chunk:
                            self.wfile.write(chunk)
                            self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass  # Closing the browser request also closes the upstream stream.
            except requests.RequestException:
                if not started:
                    self.error(503, "Local Dream backend is not ready")
            finally:
                self.close_connection = True
    return Handler

def make_server(port, upstream_port, routes):
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(upstream_port, routes))
    server.daemon_threads = True
    return server

def main():
    servers = [make_server(8807, 8808, CONTROL_ROUTES),
               make_server(8806, 8081, GENERATION_ROUTES)]
    done = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: done.set())
    signal.signal(signal.SIGINT, lambda *_: done.set())
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    print("Local Dream browser bridge ready: 127.0.0.1:8807 control, :8806 inference", flush=True)
    done.wait()
    for server in servers:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    main()
