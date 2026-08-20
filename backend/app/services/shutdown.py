"""Stop ForgeDeck: close launcher terminals, then kill API/UI processes.

Used by POST /api/shutdown (localhost only). Safe to call from pytest when
schedule_shutdown is mocked; the real path ends with os._exit.
"""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
import sys
import threading
import time

log = logging.getLogger("forgedeck.shutdown")

# Window titles set by start.bat / mac/*.command (must stay in sync).
WINDOW_TITLES = ("ForgeDeck API", "ForgeDeck UI", "ForgeDeck launcher")

LOOPBACK_HOSTS = {
    "127.0.0.1",
    "::1",
    "localhost",
    "testclient",
    "::ffff:127.0.0.1",
}


def is_local_client(host: str | None) -> bool:
    """True when the TCP peer is this machine (or the Starlette TestClient)."""
    if not host:
        return False
    return host.strip().lower() in LOOPBACK_HOSTS


def _is_windows() -> bool:
    return sys.platform == "win32"


def _kill_windows_windows() -> None:
    for title in WINDOW_TITLES:
        subprocess.run(
            ["taskkill", "/FI", f"WINDOWTITLE eq {title}*", "/T", "/F"],
            capture_output=True,
            timeout=15,
            check=False,
        )


def _kill_macos_windows() -> None:
    """Close Terminal / iTerm windows whose title contains ForgeDeck."""
    script = """
tell application "System Events"
  set termRunning to (exists process "Terminal")
  set itermRunning to ((exists process "iTerm2") or (exists process "iTerm"))
end tell
if termRunning then
  tell application "Terminal"
    repeat with w in (get windows)
      try
        if name of w contains "ForgeDeck" then
          close w
        end if
      end try
    end repeat
  end tell
end if
if itermRunning then
  tell application "iTerm"
    repeat with w in windows
      try
        if name of w contains "ForgeDeck" then
          close w
        end if
      end try
    end repeat
  end tell
end if
"""
    subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        timeout=20,
        check=False,
    )


def _pids_on_port_windows(port: int) -> list[int]:
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    pids: set[int] = set()
    needle = f":{port}"
    for line in result.stdout.splitlines():
        if needle not in line:
            continue
        listening = "LISTENING" in line.upper() or "ПРОСЛУШ" in line
        if not listening:
            continue
        parts = line.split()
        if not parts:
            continue
        try:
            pids.add(int(parts[-1]))
        except ValueError:
            continue
    return [p for p in pids if p > 4]


def _pids_on_port_unix(port: int) -> list[int]:
    lsof = shutil.which("lsof")
    if not lsof:
        return []
    try:
        result = subprocess.run(
            [lsof, "-ti", f"tcp:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    pids: list[int] = []
    for token in result.stdout.split():
        try:
            pid = int(token)
        except ValueError:
            continue
        if pid > 1:
            pids.append(pid)
    return pids


def _parent_pid(pid: int) -> int | None:
    if _is_windows():
        try:
            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    f"(Get-CimInstance Win32_Process -Filter 'ProcessId={int(pid)}').ParentProcessId",
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        try:
            ppid = int(result.stdout.strip().split()[0])
        except (ValueError, IndexError):
            return None
        return ppid if ppid > 4 else None
    try:
        result = subprocess.run(
            ["ps", "-o", "ppid=", "-p", str(pid)],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    try:
        ppid = int(result.stdout.strip().split()[0])
    except (ValueError, IndexError):
        return None
    return ppid if ppid > 1 else None


def _kill_pid_tree(pid: int) -> None:
    if pid <= 1:
        return
    if _is_windows():
        if pid <= 4:
            return
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            timeout=10,
            check=False,
        )
        return
    try:
        os.kill(pid, 15)
    except OSError:
        pass
    time.sleep(0.15)
    try:
        os.kill(pid, 9)
    except OSError:
        pass


def _kill_listeners(port: int) -> None:
    pids = _pids_on_port_windows(port) if _is_windows() else _pids_on_port_unix(port)
    extra: list[int] = []
    for pid in pids:
        parent = _parent_pid(pid)
        if parent and parent not in pids:
            extra.append(parent)
    for pid in extra + pids:
        log.info("killing pid %s (port %s)", pid, port)
        _kill_pid_tree(pid)


def run_shutdown() -> None:
    """Close launcher windows, free 5173/8000, then exit this process."""
    log.info("ForgeDeck shutdown requested")
    try:
        if _is_windows():
            _kill_windows_windows()
        elif platform.system() == "Darwin":
            _kill_macos_windows()
        # UI first so the Vite proxy is gone before we kill ourselves on 8000.
        _kill_listeners(5173)
        _kill_listeners(8000)
    except Exception:
        log.exception("shutdown helpers failed")
    os._exit(0)


def schedule_shutdown(delay_sec: float = 0.45) -> None:
    """Return from the HTTP handler first, then shut down."""

    def _go() -> None:
        time.sleep(delay_sec)
        run_shutdown()

    threading.Thread(target=_go, name="forgedeck-shutdown", daemon=True).start()
