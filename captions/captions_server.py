import getpass
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = 8765
ALLOWED_HOSTS = {
    f"localhost:{PORT}",
    f"127.0.0.1:{PORT}",
}

PAGE_PATH = Path(__file__).with_name("captions.html")

# Finished caption lines are forwarded here, so every phone in the session shows them.
# Set AURABEAT_BACKEND="" to keep captions on this page only.
BACKEND = os.environ.get("AURABEAT_BACKEND", "http://127.0.0.1:8001").rstrip("/")
SESSION = os.environ.get("AURABEAT_SESSION", "demo")


def forward_caption(text, final):
    """POST one caption to the AuraBeat backend. Returns how many phones got it, or None if unreachable."""
    if not BACKEND:
        return None
    request = urllib.request.Request(
        f"{BACKEND}/sessions/{SESSION}/caption",
        data=json.dumps({"text": text[:500], "final": bool(final)}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            return json.load(response).get("delivered", 0)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None


def main():
    if not PAGE_PATH.is_file():
        raise SystemExit(
            f"Missing file: {PAGE_PATH}\n"
            "Save captions.html beside captions_server.py."
        )

    api_key = getpass.getpass(
        "Paste your ElevenLabs API key (hidden), then press Enter: "
    ).strip()

    if not api_key:
        raise SystemExit("No API key entered.")

    page_template = PAGE_PATH.read_text(encoding="utf-8")
    page_token = secrets.token_urlsafe(32)
    request_lock = threading.Lock()
    last_request = 0.0

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def respond(self, status, body, content_type="application/json"):
            data = (
                json.dumps(body).encode("utf-8")
                if content_type == "application/json"
                else body.encode("utf-8")
            )

            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Permissions-Policy",
                "microphone=(self), camera=()",
            )
            self.end_headers()

            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def valid_host(self):
            return self.headers.get("Host", "") in ALLOWED_HOSTS

        def do_GET(self):
            if not self.valid_host():
                self.respond(403, {"error": "Use localhost to open this test."})
                return

            if self.path not in ("/", "/captions.html"):
                self.respond(404, {"error": "Not found."})
                return

            page = page_template.replace("__PAGE_TOKEN__", page_token)
            self.respond(200, page, "text/html; charset=utf-8")

        def do_POST(self):
            nonlocal last_request

            host = self.headers.get("Host", "")
            origin = self.headers.get("Origin", "")
            supplied_token = self.headers.get("X-Caption-Page", "")

            authorized = (
                self.valid_host()
                and origin == f"http://{host}"
                and secrets.compare_digest(
                    supplied_token.encode("utf-8"),
                    page_token.encode("utf-8"),
                )
            )

            if not authorized:
                self.respond(403, {"error": "Reload the local captions page."})
                return

            if self.path not in ("/scribe-token", "/caption"):
                self.respond(404, {"error": "Not found."})
                return

            try:
                body_size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.respond(400, {"error": "Invalid request."})
                return

            limit = 4000 if self.path == "/caption" else 64
            if (
                body_size < 0
                or body_size > limit
                or self.headers.get("Transfer-Encoding")
            ):
                self.respond(400, {"error": "Invalid request."})
                return

            if self.path == "/caption":
                self.connection.settimeout(20)
                try:
                    body = json.loads(self.rfile.read(body_size) or b"{}")
                    text = str(body.get("text", "")).strip()
                except ValueError:
                    self.respond(400, {"error": "Invalid request."})
                    return
                if not text:
                    self.respond(400, {"error": "Empty caption."})
                    return
                delivered = forward_caption(text, body.get("final", True))
                self.respond(200, {"forwarded": delivered is not None, "delivered": delivered or 0})
                return

            self.connection.settimeout(20)
            if body_size:
                self.rfile.read(body_size)

            if not request_lock.acquire(blocking=False):
                self.respond(429, {"error": "A connection is already starting."})
                return

            try:
                now = time.monotonic()

                if now - last_request < 5:
                    self.respond(
                        429,
                        {"error": "Wait five seconds before starting again."},
                    )
                    return

                last_request = now

                request = urllib.request.Request(
                    "https://api.elevenlabs.io/v1/"
                    "single-use-token/realtime_scribe",
                    headers={
                        "xi-api-key": api_key,
                        "Accept": "application/json",
                    },
                    data=b"",
                    method="POST",
                )

                try:
                    with urllib.request.urlopen(
                        request, timeout=15
                    ) as response:
                        result = json.load(response)

                    token = result.get("token")
                    if not isinstance(token, str) or not token:
                        self.respond(
                            502,
                            {"error": "ElevenLabs did not return a token."},
                        )
                        return

                    self.respond(200, {"token": token})

                except urllib.error.HTTPError as error:
                    explanations = {
                        401: "ElevenLabs rejected the API key.",
                        403: "Check ElevenLabs API permissions and account access.",
                        429: "ElevenLabs rate or account limit reached.",
                    }
                    self.respond(
                        502,
                        {
                            "error": explanations.get(
                                error.code,
                                f"ElevenLabs returned HTTP {error.code}.",
                            )
                        },
                    )

                except (
                    urllib.error.URLError,
                    TimeoutError,
                    OSError,
                    ValueError,
                ):
                    self.respond(
                        502,
                        {
                            "error":
                            "Could not obtain a token. Check your internet connection."
                        },
                    )

            finally:
                request_lock.release()

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.daemon_threads = True

    print()
    print(f"Open this in your laptop browser: http://localhost:{PORT}")
    print("Keep this terminal window open.")
    if BACKEND:
        print(f"Captions are also sent to every phone via the AuraBeat backend at {BACKEND} (session {SESSION}).")
    print("Your API key is kept in memory, not written to a file.")
    print("This server is local-only. Do not deploy it as your public backend.")
    print("Press Ctrl+C here to stop the server.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCaption server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled.")