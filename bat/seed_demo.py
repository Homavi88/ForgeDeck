"""Create a short 120 BPM WAV so the first Library upload is one drag away."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "storage" / "audio" / "demo-loop.wav"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sr = 44100
    bpm = 120.0
    bars = 4
    duration = bars * 4 * (60.0 / bpm)
    n = int(sr * duration)
    t = np.linspace(0.0, duration, n, endpoint=False)
    tone = 0.12 * np.sin(2 * np.pi * 110.0 * t)
    click = np.zeros(n, dtype=np.float32)
    beat = int(sr * 60.0 / bpm)
    for i, start in enumerate(range(0, n, beat)):
        length = min(int(0.035 * sr), n - start)
        env = np.linspace(1.0, 0.0, length, dtype=np.float32)
        amp = 0.75 if i % 4 == 0 else 0.32
        click[start : start + length] += env * amp
    audio = np.clip(tone.astype(np.float32) + click, -1.0, 1.0)
    sf.write(str(OUT), audio, sr)
    print(OUT)


if __name__ == "__main__":
    main()
