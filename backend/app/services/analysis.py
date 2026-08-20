"""Audio analysis: duration, waveform overview, BPM, beats, key, loudness.

Realtime playback happens in the browser. This module is for *offline* analysis
so the UI can show BPM/key/beatgrid without blocking the audio thread.

librosa is optional. A numpy/soundfile fallback keeps local/dev installs light.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from app.config import get_settings

settings = get_settings()

KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _try_librosa():
    if not settings.enable_librosa:
        return None
    try:
        import librosa  # type: ignore

        return librosa
    except Exception:
        return None


def load_mono(path: Path, max_seconds: float = 180.0) -> tuple[np.ndarray, int]:
    info = sf.info(str(path))
    sr = info.samplerate
    frames = info.frames
    # Cap long files so analysis stays interactive in MVP.
    stop = min(frames, int(max_seconds * sr))
    audio, sr = sf.read(str(path), always_2d=True, stop=stop)
    mono = audio.mean(axis=1).astype(np.float32)
    peak = float(np.max(np.abs(mono)) + 1e-9)
    if peak > 1.0:
        mono = mono / peak
    return mono, int(sr)


def waveform_overview(audio: np.ndarray, bins: int = 2048) -> list[float]:
    if len(audio) == 0:
        return [0.0] * bins
    window = max(1, len(audio) // bins)
    peaks = []
    for i in range(bins):
        chunk = audio[i * window : (i + 1) * window]
        peaks.append(float(np.max(np.abs(chunk))) if len(chunk) else 0.0)
    return peaks


def estimate_bpm_numpy(audio: np.ndarray, sr: int) -> tuple[float, list[float]]:
    """Onset-energy autocorrelation BPM estimate (good enough for DJ grid MVP)."""
    hop = 512
    env = np.array(
        [np.sqrt(np.mean(audio[i : i + hop] ** 2)) for i in range(0, max(len(audio) - hop, hop), hop)],
        dtype=np.float32,
    )
    if len(env) < 32:
        return 120.0, []
    env = env - np.mean(env)
    env = np.maximum(env, 0)
    # Autocorrelation of onset envelope.
    corr = np.correlate(env, env, mode="full")[len(env) - 1 :]
    min_lag = int((60.0 / 180.0) * sr / hop)
    max_lag = int((60.0 / 70.0) * sr / hop)
    max_lag = min(max_lag, len(corr) - 1)
    min_lag = max(min_lag, 1)
    if max_lag <= min_lag:
        return 120.0, []
    lag = int(np.argmax(corr[min_lag:max_lag]) + min_lag)
    bpm = 60.0 * sr / (lag * hop)
    # Fold into typical DJ range.
    while bpm < 80:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    bpm = float(np.clip(bpm, 70.0, 200.0))
    beat_period = 60.0 / bpm
    duration = len(audio) / sr
    beats = [round(i * beat_period, 4) for i in range(int(duration / beat_period))]
    return round(bpm, 2), beats


def estimate_key_numpy(audio: np.ndarray, sr: int) -> str:
    """Very approximate key via chroma-like energy in 12 pitch classes."""
    # Downsample for speed.
    if sr > 22050:
        audio = audio[:: sr // 22050]
        sr = 22050
    n_fft = 4096
    if len(audio) < n_fft:
        return "C minor"
    window = np.hanning(n_fft)
    hop = n_fft // 2
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    chroma = np.zeros(12, dtype=np.float64)
    for start in range(0, len(audio) - n_fft, hop * 4):
        spectrum = np.abs(np.fft.rfft(audio[start : start + n_fft] * window))
        mag = spectrum**2
        for k, f in enumerate(freqs):
            if f < 40 or f > 5000:
                continue
            midi = 69 + 12 * math.log2(max(f, 1e-6) / 440.0)
            chroma[int(round(midi)) % 12] += mag[k]
    if chroma.sum() == 0:
        return "C minor"
    chroma = chroma / (np.linalg.norm(chroma) + 1e-9)
    best = ("C", "minor", -1e9)
    for i in range(12):
        major = float(np.dot(chroma, np.roll(MAJOR_PROFILE / np.linalg.norm(MAJOR_PROFILE), i)))
        minor = float(np.dot(chroma, np.roll(MINOR_PROFILE / np.linalg.norm(MINOR_PROFILE), i)))
        if major > best[2]:
            best = (KEY_NAMES[i], "major", major)
        if minor > best[2]:
            best = (KEY_NAMES[i], "minor", minor)
    return f"{best[0]} {best[1]}"


def analyze_file(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    info = sf.info(str(path))
    audio, sr = load_mono(path)
    duration = float(info.frames / info.samplerate) if info.samplerate else len(audio) / sr
    peaks = waveform_overview(audio)
    rms = float(np.sqrt(np.mean(audio**2))) if len(audio) else 0.0
    peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
    lufs_approx = 20 * math.log10(rms + 1e-9)

    librosa = _try_librosa()
    beats: list[float]
    if librosa is not None:
        y, lr_sr = librosa.load(str(path), sr=22050, mono=True, duration=180)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=lr_sr)
        bpm = float(np.atleast_1d(tempo)[0])
        beats = [round(float(t), 4) for t in librosa.frames_to_time(beat_frames, sr=lr_sr)]
        chroma = librosa.feature.chroma_cqt(y=y, sr=lr_sr)
        chroma_mean = chroma.mean(axis=1)
        key = estimate_key_from_chroma(chroma_mean)
        onsets = librosa.onset.onset_detect(y=y, sr=lr_sr, units="time")
        onset_times = [round(float(t), 4) for t in onsets[:200]]
    else:
        bpm, beats = estimate_bpm_numpy(audio, sr)
        key = estimate_key_numpy(audio, sr)
        onset_times = beats[::2]

    from app.services.harmony import camelot

    return {
        "duration": round(duration, 4),
        "sample_rate": int(info.samplerate),
        "channels": int(info.channels),
        "waveform": [round(v, 4) for v in peaks],
        "bpm": round(float(bpm), 2),
        "beats": beats[:800],
        "key": key,
        "camelot": camelot(key),
        "loudness_rms": round(rms, 5),
        "peak": round(peak, 5),
        "loudness_db": round(lufs_approx, 2),
        "onsets": onset_times[:200],
        "engine": "librosa" if librosa is not None else "numpy",
    }


def estimate_key_from_chroma(chroma: np.ndarray) -> str:
    chroma = chroma / (np.linalg.norm(chroma) + 1e-9)
    best = ("C", "minor", -1e9)
    for i in range(12):
        major = float(np.dot(chroma, np.roll(MAJOR_PROFILE / np.linalg.norm(MAJOR_PROFILE), i)))
        minor = float(np.dot(chroma, np.roll(MINOR_PROFILE / np.linalg.norm(MINOR_PROFILE), i)))
        if major > best[2]:
            best = (KEY_NAMES[i], "major", major)
        if minor > best[2]:
            best = (KEY_NAMES[i], "minor", minor)
    return f"{best[0]} {best[1]}"


def persist_analysis(db, audio_file, result: dict[str, Any]) -> None:
    from app.models import BeatGrid

    audio_file.duration = result["duration"]
    audio_file.sample_rate = result["sample_rate"]
    audio_file.channels = result["channels"]
    audio_file.analysis = result
    audio_file.analysis_status = "ready"
    audio_file.error_message = None

    grid = audio_file.beat_grid
    if grid is None:
        grid = BeatGrid(audio_file_id=audio_file.id)
        db.add(grid)
    grid.bpm = result["bpm"]
    grid.first_beat_offset = result["beats"][0] if result["beats"] else 0.0
    grid.beats = result["beats"]
    db.add(audio_file)
    db.commit()
