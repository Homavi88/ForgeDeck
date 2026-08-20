def test_register_login_me(client):
    reg = client.post("/api/auth/register", json={"email": "dj@test.local", "name": "DJ", "password": "secret"})
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "dj@test.local"
    login = client.post("/api/auth/login", json={"email": "dj@test.local", "password": "secret"})
    assert login.status_code == 200
    bad = client.post("/api/auth/login", json={"email": "dj@test.local", "password": "nope"})
    assert bad.status_code == 401


def test_fx_presets_seed(client):
    res = client.get("/api/presets/effects")
    assert res.status_code == 200
    assert len(res.json()) >= 1
    midi = client.get("/api/presets/midi")
    assert midi.json()[0]["bindings"]["cc"]["7"] == "master.volume"
    kits = client.get("/api/presets/kits")
    assert kits.status_code == 200
    assert kits.json()[0]["name"] == "808 Core"
    saved = client.post("/api/presets/kits", json={"name": "Mine", "pads": [{"id": "kick"}]})
    assert saved.status_code == 200


def test_offline_render_upload(client, wav_file):
    project = client.post("/api/projects", json={"name": "Mix"}).json()
    with wav_file.open("rb") as fh:
        res = client.post(
            f"/api/projects/{project['id']}/render/upload",
            files={"file": ("mix.wav", fh, "audio/wav")},
        )
    assert res.status_code == 200, res.text
    job = res.json()
    assert job["status"] == "done"
    dl = client.get(f"/api/projects/{project['id']}/render/{job['id']}/file")
    assert dl.status_code == 200
    assert dl.content[:4] == b"RIFF"
