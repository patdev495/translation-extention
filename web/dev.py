"""Run FastAPI and Vue dev servers together. Invoke: python web/dev.py."""

from __future__ import annotations

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
VENV_PYTHON = WEB / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        )
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main() -> int:
    if not VENV_PYTHON.exists():
        print("Missing web/.venv. Run uv sync --project web first.", file=sys.stderr)
        return 1
    if not (WEB / "node_modules").exists():
        print("Missing web/node_modules. Run npm ci in web first.", file=sys.stderr)
        return 1
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if npm is None:
        print("npm was not found in PATH.", file=sys.stderr)
        return 1
    for port in (8000, 5173):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                print(f"Port {port} is in use. Stop the old dev service first.", file=sys.stderr)
                return 1

    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    print("API: http://127.0.0.1:8000 | Web: http://127.0.0.1:5173", flush=True)
    backend = subprocess.Popen(
        [str(VENV_PYTHON), "-m", "uvicorn", "web.server.main:app", "--reload",
         "--reload-dir", "web/server", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT, creationflags=flags, start_new_session=os.name != "nt",
    )
    frontend = subprocess.Popen(
        [npm, "run", "dev"], cwd=WEB,
        creationflags=flags, start_new_session=os.name != "nt",
    )
    try:
        while True:
            if backend.poll() is not None:
                print(f"API stopped (exit {backend.returncode}).", file=sys.stderr)
                return 1
            if frontend.poll() is not None:
                print(f"Web stopped (exit {frontend.returncode}).", file=sys.stderr)
                return 1
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("Stopping both services...", flush=True)
        return 0
    finally:
        stop_process(frontend)
        stop_process(backend)


if __name__ == "__main__":
    raise SystemExit(main())
