import numpy as np
import soundfile as sf

from app.services.stems import hpss_stems, select_stems_device, separate_stems


def _tone(tmp_path):
    sr = 22050
    t = np.linspace(0, 0.6, int(sr * 0.6), endpoint=False)
    y = 0.2 * np.sin(2 * np.pi * 220 * t)
    y[:: int(sr * 0.25)] += 0.8
    wav = tmp_path / "x.wav"
    sf.write(wav, y.astype(np.float32), sr)
    return wav


def test_hpss_writes_stems(tmp_path):
    wav = _tone(tmp_path)
    paths = hpss_stems(wav, tmp_path / "stems")
    assert set(paths) >= {"vocals", "drums", "bass", "other"}
    for p in paths.values():
        assert Pathish(p).exists()


def Pathish(p):
    from pathlib import Path

    return Path(p)


def test_select_device_explicit(monkeypatch):
    monkeypatch.setenv("STEMS_DEVICE", "mps")
    assert select_stems_device() == "mps"
    monkeypatch.setenv("STEMS_DEVICE", "cuda")
    assert select_stems_device() == "cuda"
    monkeypatch.setenv("STEMS_DEVICE", "cpu")
    assert select_stems_device() == "cpu"


def test_select_device_auto_cuda(monkeypatch):
    monkeypatch.setenv("STEMS_DEVICE", "auto")

    class Torch:
        class cuda:
            @staticmethod
            def is_available():
                return True

        class backends:
            class mps:
                @staticmethod
                def is_available():
                    return False

    assert select_stems_device(Torch()) == "cuda"


def test_select_device_auto_cpu_without_torch(monkeypatch):
    monkeypatch.setenv("STEMS_DEVICE", "auto")
    monkeypatch.setattr("app.services.stems._import_torch", lambda: None)
    assert select_stems_device() == "cpu"


def test_separate_stems_gpu_demucs(monkeypatch, tmp_path):
    wav = _tone(tmp_path)

    def fake_python(src, out_dir, device):
        assert device == "cuda"
        out_dir.mkdir(parents=True, exist_ok=True)
        paths = {}
        for name in ("vocals", "drums", "bass", "other"):
            p = out_dir / f"{name}.wav"
            sf.write(p, np.zeros(64, dtype=np.float32), 22050)
            paths[name] = str(p)
        return paths

    monkeypatch.setenv("STEMS_DEVICE", "cuda")
    monkeypatch.setattr("app.services.stems._demucs_python", fake_python)
    monkeypatch.setattr("app.services.stems._demucs_cli", lambda *a, **k: None)
    paths, engine = separate_stems(wav, tmp_path / "stems")
    assert engine == "demucs-cuda"
    assert set(paths) >= {"vocals", "drums", "bass", "other"}


def test_separate_stems_falls_back_hpss(monkeypatch, tmp_path):
    wav = _tone(tmp_path)
    monkeypatch.setenv("STEMS_DEVICE", "cpu")
    monkeypatch.setattr("app.services.stems._demucs_python", lambda *a, **k: None)
    monkeypatch.setattr("app.services.stems._demucs_cli", lambda *a, **k: None)
    paths, engine = separate_stems(wav, tmp_path / "stems")
    assert engine == "hpss"
    assert set(paths) >= {"vocals", "drums", "bass", "other"}
