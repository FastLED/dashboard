"""Capture the real Chart.js overview for the README and Pages site."""

import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT / "docs"))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 1440, "height": 820}, device_scale_factor=1
            )
            page.goto(
                f"http://127.0.0.1:{server.server_port}", wait_until="networkidle"
            )
            page.wait_for_function(
                "document.querySelectorAll('.chart canvas').length === 2"
            )
            destination = ROOT / "docs/assets/dashboard.png"
            destination.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(destination))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()
