from app.services.analysis import analyze_file


def test_upload_and_analysis(client, wav_file):
    with wav_file.open("rb") as fh:
        res = client.post("/api/audio/upload", files={"file": ("loop.wav", fh, "audio/wav")})
    assert res.status_code == 200, res.text
    audio = res.json()
    assert audio["original_filename"] == "loop.wav"
    audio_id = audio["id"]

    # Analysis is background-threaded; run synchronously for the test.
    detail = client.get(f"/api/audio/{audio_id}").json()
    result = analyze_file(detail["path"] if "path" in detail else wav_file)
    # Path is not in schema; analyze the source fixture to assert algorithm.
    assert result["duration"] > 1.5
    assert result["bpm"] > 60
    assert "waveform" in result
    assert len(result["waveform"]) > 100

    analysis = client.get(f"/api/audio/{audio_id}/analysis")
    assert analysis.status_code == 200


def test_reject_bad_extension(client, tmp_path):
    bad = tmp_path / "notes.txt"
    bad.write_text("not audio")
    with bad.open("rb") as fh:
        res = client.post("/api/audio/upload", files={"file": ("notes.txt", fh, "text/plain")})
    assert res.status_code == 400
