#!/usr/bin/env python3
"""
⚡ Antigravity (agy) Host Bridge Server
======================================
Provides a lightweight HTTP bridge on the macOS host (0.0.0.0:23333) so that
Docker containers (connecting via host.docker.internal:23333) or external services
can invoke the host's `/Users/houtokki/.local/bin/agy` CLI seamlessly.

Supports:
- Multi-turn conversation (--conversation <id>)
- High reasoning effort (--effort high)
- JSON structured output (--output-format json)
"""

import sys
import os
import json
import subprocess
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

AGY_PATH = os.environ.get("AGY_PATH", "/Users/houtokki/.local/bin/agy")
PORT = int(os.environ.get("AGY_BRIDGE_PORT", "23333"))

class AgyBridgeHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"status": "ok"})

    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            agy_exists = os.path.exists(AGY_PATH) and os.access(AGY_PATH, os.X_OK)
            self._send_json(200, {
                "status": "UP",
                "service": "agy-host-bridge",
                "agy_path": AGY_PATH,
                "agy_available": agy_exists
            })
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path != "/agy":
            self._send_json(404, {"error": "Not Found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._send_json(400, {"error": "Empty request body"})
            return

        try:
            body = self.rfile.read(content_length).decode("utf-8")
            req = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON body: {str(e)}"})
            return

        prompt = req.get("prompt", "").strip()
        conversation_id = req.get("conversationId", "").strip()
        effort = req.get("effort", "high").strip()

        if not prompt:
            self._send_json(400, {"error": "prompt is required"})
            return

        if not (os.path.exists(AGY_PATH) and os.access(AGY_PATH, os.X_OK)):
            self._send_json(500, {
                "success": False,
                "errorMsg": f"agy executable not found or not executable at {AGY_PATH}"
            })
            return

        cmd = [
            AGY_PATH,
            "--output-format", "json",
            "--effort", effort,
        ]
        if conversation_id:
            cmd.extend(["--conversation", conversation_id])
        cmd.extend(["--prompt", prompt])

        print(f"🚀 [agy bridge] Executing: convId={conversation_id}, effort={effort}, promptLen={len(prompt)}")
        start_time = time.time()

        try:
            env = dict(os.environ)
            env["PATH"] = env.get("PATH", "") + ":/usr/local/bin:/usr/bin:/bin:/Users/houtokki/.local/bin"
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180, env=env)
            duration = round(time.time() - start_time, 3)

            if proc.returncode != 0:
                print(f"❌ [agy bridge] Process error: code={proc.returncode}, stderr={proc.stderr}")
                self._send_json(500, {
                    "success": False,
                    "errorMsg": f"agy error (code {proc.returncode}): {proc.stderr or proc.stdout}",
                    "durationSeconds": duration
                })
                return

            raw_out = proc.stdout.strip()
            # Try to parse json from agy
            response_text = raw_out
            ret_conv_id = conversation_id
            try:
                out_json = json.loads(raw_out)
                if "response" in out_json:
                    response_text = out_json["response"]
                if "conversation_id" in out_json:
                    ret_conv_id = out_json["conversation_id"]
            except Exception:
                pass

            print(f"✅ [agy bridge] Success in {duration}s, convId={ret_conv_id}")
            self._send_json(200, {
                "success": True,
                "response": response_text,
                "conversationId": ret_conv_id,
                "durationSeconds": duration
            })

        except subprocess.TimeoutExpired:
            print("⏱️ [agy bridge] agy command timed out after 180s")
            self._send_json(504, {"success": False, "errorMsg": "agy command timed out after 180s"})
        except Exception as e:
            print(f"❌ [agy bridge] Execution exception: {e}")
            self._send_json(500, {"success": False, "errorMsg": f"Bridge execution exception: {str(e)}"})

def run():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, AgyBridgeHandler)
    print(f"📡 agy Host Bridge listening on http://0.0.0.0:{PORT} (AGY_PATH={AGY_PATH})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 agy Host Bridge stopped.")
        httpd.server_close()

if __name__ == "__main__":
    run()
