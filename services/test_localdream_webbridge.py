"""Transport integration tests with a real local upstream and browser Origin."""
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import requests
from localdream_webbridge import make_server, CONTROL_ROUTES, GENERATION_ROUTES, generation_port

class Upstream(BaseHTTPRequestHandler):
    cancelled = threading.Event()
    upscale_headers = {}
    def log_message(self, *_args):
        pass
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        if self.path != "/health":
            self.wfile.write(b'{"state":"running"}')
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream" if self.path == "/generate" else "image/png")
        self.end_headers()
        if self.path != "/generate":
            if self.path == "/upscale":
                type(self).upscale_headers = {key: self.headers.get(key) for key in
                    ("X-Image-Width", "X-Image-Height", "X-Upscaler-Path", "X-Use-OpenCL")}
            self.wfile.write(body)
            return
        try:
            for step in range(200):
                self.wfile.write(b'data: {"type":"progress","padding":"' + b'x' * 1024 + b'"}\n\n')
                self.wfile.flush()
                time.sleep(0.01)
        except (BrokenPipeError, ConnectionResetError):
            self.cancelled.set()

class BrowserBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
        cls.upstream.daemon_threads = True
        upstream_port = cls.upstream.server_port
        cls.control = make_server(0, upstream_port, CONTROL_ROUTES)
        cls.generation = make_server(0, upstream_port, GENERATION_ROUTES)
        for server in (cls.upstream, cls.control, cls.generation):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        cls.control_url = f"http://127.0.0.1:{cls.control.server_port}"
        cls.generation_url = f"http://127.0.0.1:{cls.generation.server_port}"
        cls.origin = {"Origin": "https://localhost"}
    @classmethod
    def tearDownClass(cls):
        for server in (cls.control, cls.generation, cls.upstream):
            server.shutdown()
            server.server_close()

    def test_post_preflight_and_control_response_allow_only_native_origin(self):
        response = requests.options(self.control_url + "/select", headers={
            **self.origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }, timeout=3)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "https://localhost")
        response = requests.get(self.control_url + "/info", headers=self.origin, timeout=3)
        self.assertEqual(response.json()["state"], "running")
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "https://localhost")

    def test_chilli_pwa_origin_is_allowed(self):
        origin = "https://chilli-production.haitham-elhusseiny-cv.workers.dev"
        response = requests.get(self.control_url + "/info", headers={"Origin": origin}, timeout=3)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], origin)

    def test_dynamic_generation_port(self):
        bridge = make_server(0, lambda: self.upstream.server_port, GENERATION_ROUTES)
        threading.Thread(target=bridge.serve_forever, daemon=True).start()
        try:
            response = requests.get(f"http://127.0.0.1:{bridge.server_port}/health", timeout=3)
            self.assertEqual(response.status_code, 200)
        finally:
            bridge.shutdown(); bridge.server_close()

    def test_invalid_advertised_port_is_rejected(self):
        from unittest.mock import patch, Mock
        for port in (None, True, 0, 65536, "18081"):
            with patch("localdream_webbridge.requests.get", return_value=Mock(json=lambda: {"generation_port": port})):
                with self.assertRaises(ValueError): generation_port()
        with patch("localdream_webbridge.requests.get", return_value=Mock(json=lambda: {"generation_port": 18081})):
            self.assertEqual(generation_port(), 18081)

    def test_untrusted_origin_and_unknown_route_are_rejected(self):
        response = requests.get(self.control_url + "/info", headers={"Origin": "https://evil.invalid"}, timeout=3)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)
        self.assertEqual(requests.get(self.control_url + "/arbitrary", timeout=3).status_code, 404)

    def test_empty_native_health_body_is_successful(self):
        response = requests.get(self.generation_url + "/health", headers=self.origin, timeout=3)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

    def test_binary_upscale_payload_is_not_encoded_or_modified(self):
        image_bytes = bytes(range(256)) * 3
        response = requests.post(self.generation_url + "/upscale", data=image_bytes, headers={
            **self.origin, "Content-Type": "application/octet-stream",
            "X-Image-Width": "16", "X-Image-Height": "16",
            "X-Upscaler-Path": "/models/upscale.bin", "X-Use-OpenCL": "true",
        }, timeout=3)
        self.assertEqual(response.content, image_bytes)
        self.assertEqual(Upstream.upscale_headers["X-Image-Width"], "16")
        self.assertEqual(Upstream.upscale_headers["X-Image-Height"], "16")
        self.assertEqual(Upstream.upscale_headers["X-Upscaler-Path"], "/models/upscale.bin")
        self.assertEqual(Upstream.upscale_headers["X-Use-OpenCL"], "true")
        preflight = requests.options(self.generation_url + "/upscale", headers={
            **self.origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-image-width,x-image-height,x-upscaler-path,x-use-opencl",
        }, timeout=3)
        self.assertEqual(preflight.status_code, 204)
        self.assertIn("X-Upscaler-Path", preflight.headers["Access-Control-Allow-Headers"])
        self.assertIn("X-Output-Width", response.headers["Access-Control-Expose-Headers"])

    def test_browser_stream_close_closes_upstream(self):
        Upstream.cancelled.clear()
        with requests.post(self.generation_url + "/generate", json={"prompt": "test"}, headers=self.origin,
                           stream=True, timeout=3) as response:
            self.assertEqual(response.headers["Content-Type"], "text/event-stream")
            self.assertIn(b"progress", next(response.iter_content(chunk_size=128)))
        self.assertTrue(Upstream.cancelled.wait(3), "Upstream stream remained open after browser cancellation")

if __name__ == "__main__":
    unittest.main()
