# Local Dream Android browser bridge

The original Local Dream Android API omits browser CORS headers. OpenVenice uses a
loopback proxy for browser requests while retaining the original app and models.

| Browser endpoint | Original endpoint | Purpose |
| --- | --- | --- |
| 127.0.0.1:8807 | 127.0.0.1:8808 | Model catalog, status, select and stop |
| 127.0.0.1:8806 | 127.0.0.1:8081 | Native health, generation SSE and binary upscale |

The proxy binds to loopback only. It accepts the native Android shell origin
`https://localhost`, handles OPTIONS preflight, rejects other browser origins,
forwards only the documented routes, and never follows upstream redirects.
Requests without a browser Origin remain available for local diagnostics.
The original host does not support request credentials; no public listener or
new remote access is introduced.

Generation keeps SSE responses streamed and preserves binary image payloads.
Closing a browser stream closes its upstream response. Explicit model shutdown
uses the existing control `/stop` endpoint. Model readiness requires a successful
native `/health` response, including its valid empty HTTP 200 body, with a
120-second startup deadline and bounded requests.

Run `sh services/install_localdream_webbridge.sh` from the phone checkout to
install runit supervision and Termux:Boot startup. Python `requests` and the
existing Termux services installation are required. Logs rotate at 128 KiB and
retain five files; prompts and images are not logged.

Validation:

- `python -m unittest discover -s services -p test_localdream_webbridge.py`
- Five connector readiness tests in `localdream-connector.test.ts`.
- Actual original app: native-origin preflight, select, health, 512×512 PNG
  generation through SSE, and final idle shutdown.
