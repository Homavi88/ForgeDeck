"""Stem split: GPU Demucs when torch+demucs are installed, else CLI, else HPSS.

Device order is cuda → mps → cpu (or STEMS_DEVICE=cuda|mps|cpu|auto).
HPSS is the fallback when Demucs is missing or fails — never claimed as GPU.
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import median_filter

STEM_NAMES = ("vocals", "drums", "bass", "other")


def _configured_device() -> str:
    env = os.environ.get("STEMS_DEVICE")
    if env:
        return env
    try:
        from app.config import get_settings

        return get_settings().stems_device
    except Exception:
        return "auto"


def _import_torch() -> Any | None:
    try:
        import torch

        return torch
    except Exception:
        return None


def select_stems_device(torch_mod: Any | None = None) -> str:
    raw = (_configured_device() or "auto").strip().lower()
    if raw in {"cuda", "mps", "cpu"}:
        return raw
    torch_mod = _import_torch() if torch_mod is None else torch_mod
    if torch_mod is None:
        return "cpu"
    try:
        if torch_mod.cuda.is_available():
            return "cuda"
        mps = getattr(torch_mod.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _device_try_order(preferred: str) -> list[str]:
    order = [preferred]
    if preferred != "cpu":
        for name in ("cuda", "mps", "cpu"):
            if name not in order:
                order.append(name)
    return order


def collect_stem_wavs(out_dir: Path) -> dict[str, str] | None:
    found: dict[str, str] = {}
    if not out_dir.exists():
        return None
    for wav in out_dir.rglob("*.wav"):
        stem = wav.stem.lower()
        if stem in STEM_NAMES:
            found[stem] = str(wav)
    return found or None


def _resample(audio: np.ndarray, sr: int, target: int) -> np.ndarray:
    if sr == target:
        return audio.astype(np.float32, copy=False)
    g = math.gcd(int(sr), int(target))
    return signal.resample_poly(audio, target // g, sr // g, axis=0).astype(np.float32)


def _demucs_python(src: Path, out_dir: Path, device: str) -> dict[str, str] | None:
    try:
        import torch
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
    except Exception:
        return None
    try:
        model = get_model("htdemucs")
        model.to(device)
        model.eval()
        audio, sr = sf.read(str(src), always_2d=True)
        audio = _resample(audio, int(sr), int(model.samplerate))
        wav = np.ascontiguousarray(audio.T)
        if wav.shape[0] == 1:
            wav = np.repeat(wav, 2, axis=0)
        elif wav.shape[0] > 2:
            wav = wav[:2]
        tensor = torch.from_numpy(wav).float().unsqueeze(0)
        with torch.no_grad():
            sources = apply_model(
                model,
                tensor,
                device=device,
                split=True,
                overlap=0.25,
                progress=False,
            )[0]
        out_dir.mkdir(parents=True, exist_ok=True)
        found: dict[str, str] = {}
        names = list(getattr(model, "sources", STEM_NAMES))
        for i, name in enumerate(names):
            stem = sources[i].detach().cpu().numpy()
            if stem.ndim == 2:
                stem = stem.T
            dest = out_dir / f"{name}.wav"
            sf.write(str(dest), stem.astype(np.float32), int(model.samplerate))
            found[name] = str(dest)
        return found or None
    except Exception:
        return None


def _demucs_cli(src: Path, out_dir: Path, device: str) -> dict[str, str] | None:
    bin_path = shutil.which("demucs")
    if not bin_path:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [bin_path, "-n", "htdemucs", "--device", device, "-o", str(out_dir), str(src)]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=900)
    except Exception:
        if device != "cpu":
            return None
        try:
            subprocess.run(
                [bin_path, "-n", "htdemucs", "-o", str(out_dir), str(src)],
                check=True,
                capture_output=True,
                timeout=900,
            )
        except Exception:
            return None
    return collect_stem_wavs(out_dir)


def try_demucs(src: Path, out_dir: Path) -> tuple[dict[str, str] | None, str | None]:
    """Return (paths, engine) where engine is demucs-cuda|demucs-mps|demucs-cpu."""
    for device in _device_try_order(select_stems_device()):
        paths = _demucs_python(src, out_dir, device)
        if paths:
            return paths, f"demucs-{device}"
    for device in _device_try_order(select_stems_device()):
        paths = _demucs_cli(src, out_dir, device)
        if paths:
            return paths, f"demucs-{device}"
    return None, None


def separate_stems(path: str | Path, out_dir: Path | None = None) -> tuple[dict[str, str], str]:
    path = Path(path)
    dest = out_dir or path.parent / "stems"
    paths, engine = try_demucs(path, dest)
    if paths and engine:
        return paths, engine
    return hpss_stems(path, dest), "hpss"


def hpss_stems(path: str | Path, out_dir: Path | None = None) -> dict[str, str]:
    path = Path(path)
    audio, sr = sf.read(str(path), always_2d=True)
    mono = audio.mean(axis=1).astype(np.float32)
    # Cap length so a 10-minute track doesn't freeze the API.
    max_len = sr * 240
    mono = mono[:max_len]

    nperseg = 2048
    _f, _t, zxx = signal.stft(mono, fs=sr, nperseg=nperseg, noverlap=nperseg // 2)
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
