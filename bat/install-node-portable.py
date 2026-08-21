"""Install a verified Node.js LTS ZIP for the current Windows user."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
import urllib.request
import uuid
import zipfile
from pathlib import Path


DIST_URL = "https://nodejs.org/dist"


def download(url: str, destination: Path) -> None:
    with urllib.request.urlopen(url) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def latest_lts() -> str:
    with urllib.request.urlopen(f"{DIST_URL}/index.json") as response:
        releases = json.load(response)
    for release in releases:
        if release.get("lts"):
            return release["version"]
    raise RuntimeError("Could not determine the current Node.js LTS release.")


def published_checksum(checksums: str, filename: str) -> str:
    for line in checksums.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1] == filename:
            return parts[0].lower()
    raise RuntimeError(f"No SHA-256 checksum was published for {filename}.")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as archive:
        for chunk in iter(lambda: archive.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_archive(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as contents:
        root = destination.resolve()
        for member in contents.infolist():
            target = (destination / member.filename).resolve()
            if root != target and root not in target.parents:
                raise RuntimeError("The Node archive contains an unsafe path.")
        contents.extractall(destination)


def install(arch: str) -> None:
    version = latest_lts()
    filename = f"node-{version}-win-{arch}.zip"
    base_url = f"{DIST_URL}/{version}"
    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    root = local_app_data / "ForgeDeck" / "node"
    current = root / "current"
    staging = root / f".staging-{uuid.uuid4().hex}"
    backup = root / ".previous"
    root.mkdir(parents=True, exist_ok=True)

    fd, archive_name = tempfile.mkstemp(prefix="ForgeDeck-", suffix=".zip")
    os.close(fd)
    archive = Path(archive_name)
    try:
        print(f"[Node] Downloading {filename} from nodejs.org...")
        download(f"{base_url}/{filename}", archive)
        with urllib.request.urlopen(f"{base_url}/SHASUMS256.txt") as response:
            checksums = response.read().decode("utf-8")

        expected = published_checksum(checksums, filename)
        if sha256(archive) != expected:
            raise RuntimeError("Downloaded Node archive checksum does not match nodejs.org.")

        extract_archive(archive, staging)
        expanded = staging / f"node-{version}-win-{arch}"
        if not (expanded / "node.exe").is_file():
            raise RuntimeError("The verified Node archive did not contain node.exe.")

        shutil.rmtree(backup, ignore_errors=True)
        if current.exists():
            current.replace(backup)
        try:
            expanded.replace(current)
        except Exception:
            if backup.exists() and not current.exists():
                backup.replace(current)
            raise
        shutil.rmtree(backup, ignore_errors=True)
        print(f"[Node] Installed Node {version} for this Windows user: {current}")
    finally:
        archive.unlink(missing_ok=True)
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--arch", choices=("x86", "x64", "arm64"), required=True)
    install(parser.parse_args().arch)
