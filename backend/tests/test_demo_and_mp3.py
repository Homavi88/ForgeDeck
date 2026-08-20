from app.services.analysis import analyze_file, load_audio
from app.services.demo_library import DEMO_FILENAME
import pytest


def test_first_project_gets_demo_on_deck_a(client):
    created = client.post("/api/projects", json={"name": "First Set", "bpm": 120})
    assert created.status_code == 200, created.text
    data = created.json()
    deck_a = next(d for d in data["decks"] if d["name"] == "A")
    assert deck_a["audio_file_id"]
    library = client.get("/api/audio").json()
    assert any(f["original_filename"] == DEMO_FILENAME for f in library)
    demo = next(f for f in library if f["original_filename"] == DEMO_FILENAME)
    assert demo["analysis_status"] == "ready"
    assert demo["id"] == deck_a["audio_file_id"]
    graph = data["graph"]
    assert graph["decks"]["A"]["audioFileId"] == demo["id"]


def test_second_project_reuses_demo_file(client):
    client.post("/api/projects", json={"name": "One"})
    client.post("/api/projects", json={"name": "Two"})
    library = client.get("/api/audio").json()
    demos = [f for f in library if f["original_filename"] == DEMO_FILENAME]
    assert len(demos) == 1


def test_mp3_analysis_without_soundfile(client, wav_file, tmp_path):
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        pytest.skip("ffmpeg only used to *create* the mp3 fixture; analysis itself uses miniaudio")
    mp3 = tmp_path / "loop.mp3"
    subprocess.run(
        [ffmpeg, "-y", "-i", str(wav_file), "-codec:a", "libmp3lame", "-q:a", "4", str(mp3)],
        check=True,
        capture_output=True,
    )
    audio, sr, channels, engine = load_audio(mp3)
    assert engine == "miniaudio"
    assert len(audio) > sr
    result = analyze_file(mp3)
    assert result["duration"] > 1.0
    assert result["bpm"] > 60
    assert "miniaudio" in result["engine"]

    with mp3.open("rb") as fh:
        res = client.post("/api/audio/upload", files={"file": ("loop.mp3", fh, "audio/mpeg")})
    assert res.status_code == 200, res.text
    assert res.json()["original_filename"] == "loop.mp3"
