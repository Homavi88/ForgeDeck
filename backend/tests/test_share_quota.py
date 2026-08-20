def test_share_link_serves_mix(client, wav_file):
    created = client.post("/api/projects", json={"name": "Share Me", "bpm": 120})
    assert created.status_code == 200, created.text
    pid = created.json()["id"]

    share = client.post(f"/api/projects/{pid}/share")
    assert share.status_code == 200, share.text
    token = share.json()["token"]
    assert token
    again = client.post(f"/api/projects/{pid}/share")
    assert again.json()["token"] == token

    meta = client.get(f"/api/share/{token}")
    assert meta.status_code == 200
    assert meta.json()["name"] == "Share Me"
    assert meta.json()["has_mix"] is False

    missing = client.get(f"/api/share/{token}/mix")
    assert missing.status_code == 404

    with wav_file.open("rb") as fh:
        up = client.post(f"/api/projects/{pid}/render/upload", files={"file": ("mix.wav", fh, "audio/wav")})
    assert up.status_code == 200, up.text

    meta2 = client.get(f"/api/share/{token}")
    assert meta2.json()["has_mix"] is True
    mix = client.get(f"/api/share/{token}/mix")
    assert mix.status_code == 200
    assert mix.headers["content-type"].startswith("audio/")
    assert len(mix.content) > 100


def test_unknown_share_404(client):
    assert client.get("/api/share/not-a-real-token").status_code == 404


def test_quota_rejects_when_full(client, wav_file, monkeypatch):
    from app.api import audio as audio_api

    monkeypatch.setattr(audio_api, "usage_bytes", lambda db, uid: 10**12)
    with wav_file.open("rb") as fh:
        res = client.post("/api/audio/upload", files={"file": ("loop.wav", fh, "audio/wav")})
    assert res.status_code == 413
    assert "quota" in res.json()["detail"].lower()
