"""Transcode a browser bounce WAV to FLAC (soundfile) or MP3 (ffmpeg if present)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf


def transcode_wav(src: Path, fmt: str) -> Path:
    kind = (fmt or "wav").lower().lstrip(".")
    if kind in ("wav", "wave"):
        return src
    audio, sr = sf.read(str(src), always_2d=True)
    audio = audio.astype(np.float32)
    if kind == "flac":
        dest = src.with_suffix(".flac")
        sf.write(str(dest), audio, sr, format="FLAC", subtype="PCM_24")
        return dest
    if kind == "mp3":
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise FileNotFoundError("ffmpeg is not installed — MP3 bounce needs libmp3lame")
        dest = src.with_suffix(".mp3")
        subprocess.run(
            [ffmpeg, "-y", "-i", str(src), "-codec:a", "libmp3lame", "-q:a", "2", str(dest)],
            check=True,
            capture_output=True,
        )
        return dest
    raise ValueError(f"Unsupported bounce format: {fmt}")
