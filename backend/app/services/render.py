"""Offline mix render. Browser engine is the live path; this is export-only.

MVP: mix loaded project audio files into a stereo WAV/MP3 via numpy + ffmpeg.
Full plugin-accurate mixdown is TODO.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import get_settings

settings = get_settings()


def mix_files(paths: list[Path], output: Path, target_sr: int = 44100) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    if not paths:
        wav_path = output.with_suffix(".wav")
        sf.write(str(wav_path), np.zeros((target_sr, 2), dtype=np.float32), target_sr)
        return wav_path

    buffers: list[np.ndarray] = []
    max_len = 0
    for path in paths:
        audio, sr = sf.read(str(path), always_2d=True)
        if sr != target_sr:
            duration = audio.shape[0] / sr
            new_len = int(duration * target_sr)
            x_old = np.linspace(0, 1, audio.shape[0])
            x_new = np.linspace(0, 1, new_len)
            audio = np.stack(
                [np.interp(x_new, x_old, audio[:, ch]) for ch in range(audio.shape[1])],
                axis=1,
            )
        if audio.shape[1] == 1:
            audio = np.repeat(audio, 2, axis=1)
        buffers.append(audio.astype(np.float32))
        max_len = max(max_len, audio.shape[0])

    mix = np.zeros((max_len, 2), dtype=np.float32)
    gain = 1.0 / max(len(buffers), 1)
    for buf in buffers:
        mix[: buf.shape[0]] += buf[:, :2] * gain

    peak = float(np.max(np.abs(mix)) + 1e-9)
    if peak > 0.99:
        mix *= 0.99 / peak

    wav_path = output.with_suffix(".wav")
    sf.write(str(wav_path), mix, target_sr)

    if output.suffix.lower() == ".mp3":
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return wav_path
        subprocess.run(
            [ffmpeg, "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-q:a", "2", str(output)],
            check=True,
            capture_output=True,
        )
        return output
    return wav_path
