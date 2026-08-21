"""Build the self-contained Windows FastAPI sidecar for Electron releases."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DESKTOP = ROOT / "desktop"
DIST = DESKTOP / "dist" / "server"
WORK = DESKTOP / ".pyinstaller-work"
SPEC = DESKTOP / ".pyinstaller-spec"


def main() -> None:
    for directory in (DIST, WORK, SPEC):
        shutil.rmtree(directory, ignore_errors=True)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--name",
            "ForgeDeckServer",
            "--paths",
            str(ROOT),
            "--paths",
            str(ROOT / "backend"),
            "--collect-submodules",
            "app",
            "--hidden-import",
            "multipart",
            "--distpath",
            str(DIST),
            "--workpath",
            str(WORK),
            "--specpath",
            str(SPEC),
            str(ROOT / "backend" / "desktop_server.py"),
        ],
        check=True,
        cwd=ROOT,
    )


if __name__ == "__main__":
    main()
