from app.services.analysis import analyze_file, estimate_bpm_numpy, waveform_overview
import numpy as np


def test_waveform_and_bpm(wav_file):
    result = analyze_file(wav_file)
    assert result["sample_rate"] == 22050
    assert 0 <= result["peak"] <= 1.01
    assert len(result["waveform"]) == 2048
    assert result["key"]


def test_bpm_estimator_detects_pulse():
    sr = 22050
    bpm = 120
    period = int(sr * 60 / bpm)
    audio = np.zeros(sr * 4, dtype=np.float32)
    audio[::period] = 1.0
    est, beats = estimate_bpm_numpy(audio, sr)
    assert abs(est - 120) < 8 or abs(est - 60) < 8 or abs(est - 240) < 8
    assert waveform_overview(audio, 16)
