"""Harmonic/percussive stem split without PyTorch.

Real Demucs remains optional. HPSS is good enough for DJ stems:
percussive ≈ drums, harmonic ≈ music, residual ≈ leftover.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import median_filter


def hpss_stems(path: str | Path, out_dir: Path | None = None) -> dict[str, str]:
    path = Path(path)
    audio, sr = sf.read(str(path), always_2d=True)
    mono = audio.mean(axis=1).astype(np.float32)
    # Cap length so a 10-minute track doesn't freeze the API.
    max_len = sr * 240
    mono = mono[:max_len]

    nperseg = 2048
    f, t, zxx = signal.stft(mono, fs=sr, nperseg=nperseg, noverlap=nperseg // 2)
    mag = np.abs(zxx)
    phase = np.exp(1j * np.angle(zxx))
    harm_mag = median_filter(mag, size=(1, 17))
    perc_mag = median_filter(mag, size=(17, 1))
    total = harm_mag + perc_mag + 1e-8
    mask_h = harm_mag / total
    mask_p = perc_mag / total
    harm = np.clip(mask_h * mag, 0, None) * phase
    perc = np.clip(mask_p * mag, 0, None) * phase
    resid = (mag - np.abs(harm) - np.abs(perc)) * phase

    def istft(mat: np.ndarray) -> np.ndarray:
        _, y = signal.istft(mat, fs=sr, nperseg=nperseg, noverlap=nperseg // 2)
        peak = float(np.max(np.abs(y)) + 1e-9)
        if peak > 1:
            y = y / peak
        return y.astype(np.float32)

    out_dir = out_dir or path.parent / "stems"
    out_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "vocals": istft(harm),  # harmonic stand-in until Demucs
        "drums": istft(perc),
        "other": istft(resid),
        "bass": _lowpass(istft(harm), sr, 180),
    }
    paths: dict[str, str] = {}
    for name, buf in mapping.items():
        dest = out_dir / f"{name}.wav"
        sf.write(str(dest), buf, sr)
        paths[name] = str(dest)
    return paths


def _lowpass(y: np.ndarray, sr: int, cutoff: float) -> np.ndarray:
    b, a = signal.butter(4, cutoff / (sr / 2), btype="low")
    return signal.filtfilt(b, a, y).astype(np.float32)
