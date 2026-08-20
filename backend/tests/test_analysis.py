from app.services.analysis import analyze_file, energy_1_to_10, estimate_bpm_numpy, mix_in_out, waveform_overview
import numpy as np


def test_waveform_and_bpm(wav_file):
    result = analyze_file(wav_file)
    assert result["sample_rate"] == 22050
    assert 0 <= result["peak"] <= 1.01
    assert len(result["waveform"]) == 2048
    assert result["key"]
    assert 1 <= result["energy"] <= 10
    assert "mix_in" in result and "mix_out" in result
    assert 0 <= result["mix_in"] <= result["mix_out"] <= result["duration"] + 1e-6


def test_bpm_estimator_detects_pulse():
    sr = 22050
    bpm = 120
    period = int(sr * 60 / bpm)
    audio = np.zeros(sr * 4, dtype=np.float32)
    audio[::period] = 1.0
    est, beats = estimate_bpm_numpy(audio, sr)
    assert abs(est - 120) < 8 or abs(est - 60) < 8 or abs(est - 240) < 8
    assert waveform_overview(audio, 16)


def test_energy_scale():
    assert energy_1_to_10(-28.0, 0.01) == 1
    assert 4 <= energy_1_to_10(-16.0, 0.15) <= 8
    assert energy_1_to_10(-4.0, 0.4) == 10


def test_mix_in_out_phrase():
    bpm = 120.0
    beat = 0.5
    beats = [round(i * beat, 4) for i in range(64)]
    duration = 32.0
    mix_in, mix_out = mix_in_out(beats, [], duration, bpm)
    assert mix_in == 0.0
    # last phrase ≈ 8 bars (16s) before the last beat
    assert 14.0 <= mix_out <= 18.0
    mix_in2, mix_out2 = mix_in_out([], [], 8.0, bpm)
    assert mix_in2 == 0.0
    assert mix_out2 == 0.0 or mix_out2 < 8.0
