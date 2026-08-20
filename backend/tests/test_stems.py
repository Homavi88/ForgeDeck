import numpy as np
import soundfile as sf

from app.services.stems import hpss_stems


def test_hpss_writes_stems(tmp_path):
    sr = 22050
    t = np.linspace(0, 0.6, int(sr * 0.6), endpoint=False)
    y = 0.2 * np.sin(2 * np.pi * 220 * t)
    y[:: int(sr * 0.25)] += 0.8
    wav = tmp_path / "x.wav"
    sf.write(wav, y.astype(np.float32), sr)
    paths = hpss_stems(wav, tmp_path / "stems")
    assert set(paths) >= {"vocals", "drums", "bass", "other"}
    for p in paths.values():
        assert (tmp_path / "stems" / __import__("pathlib").Path(p).name).exists() or __import__("pathlib").Path(p).exists()
