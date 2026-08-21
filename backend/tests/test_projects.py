def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_project_crud(client):
    created = client.post("/api/projects", json={"name": "Night Set", "bpm": 124})
    assert created.status_code == 200, created.text
    data = created.json()
    assert data["name"] == "Night Set"
    assert len(data["decks"]) == 2
    assert len(data["mixer_channels"]) >= 3
    pid = data["id"]

    listed = client.get("/api/projects")
    assert any(p["id"] == pid for p in listed.json())

    updated = client.put(f"/api/projects/{pid}", json={"bpm": 128, "graph": {"mode": "dj"}})
    assert updated.json()["bpm"] == 128

    dup = client.post(f"/api/projects/{pid}/duplicate")
    assert dup.status_code == 200
    assert "Copy" in dup.json()["name"]

    exported = client.get(f"/api/projects/{pid}/export")
    assert exported.status_code == 200
    assert exported.json()["id"] == pid

    deleted = client.delete(f"/api/projects/{pid}")
    assert deleted.json()["ok"] is True


def test_autosave_upserts_main_pattern(client):
    pid = client.post("/api/projects", json={"name": "Autosave"}).json()["id"]
    graph = {
        "bpm": 122,
        "drums": {"steps": {"kick": [1, 0, 1]}, "length": 16, "swing": 0.1},
        "synth": {"oscType": "sawtooth", "gain": 0.3},
    }
    first = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert first.status_code == 200, first.text
    second = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert second.status_code == 200, second.text

    a = client.post(
        f"/api/projects/{pid}/patterns",
        json={"name": "Main", "steps": {"kick": [1]}, "length": 16},
    )
    b = client.post(
        f"/api/projects/{pid}/patterns",
        json={"name": "Main", "steps": {"kick": [1, 1]}, "length": 32},
    )
    assert a.status_code == 200, a.text
    assert b.status_code == 200, b.text
    assert a.json()["id"] == b.json()["id"]

    mains = [p for p in client.get(f"/api/projects/{pid}").json()["drum_patterns"] if p["name"] == "Main"]
    assert len(mains) == 1
    assert mains[0]["length"] == 32


def test_persist_graph_heals_duplicate_main(client):
    from sqlalchemy import text

    from app.database import SessionLocal, engine
    from app.models import DrumPattern

    pid = client.post("/api/projects", json={"name": "Dup Main"}).json()["id"]
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX IF EXISTS uq_drum_patterns_project_name"))
    db = SessionLocal()
    try:
        db.add(DrumPattern(project_id=pid, name="Main", steps={"a": [1]}))
        db.add(DrumPattern(project_id=pid, name="Main", steps={"b": [1]}))
        db.commit()
    finally:
        db.close()

    res = client.put(
        f"/api/projects/{pid}",
        json={"graph": {"bpm": 120, "drums": {"steps": {"kick": [1]}, "length": 16, "swing": 0}}},
    )
    assert res.status_code == 200, res.text
    mains = [p for p in client.get(f"/api/projects/{pid}").json()["drum_patterns"] if p["name"] == "Main"]
    assert len(mains) == 1


def test_persist_extra_mixer_lane(client):
    pid = client.post("/api/projects", json={"name": "Prod"}).json()["id"]
    graph = {
        "mixer": {
            "A": {"volume": 0.8},
            "t-audio01": {"volume": 0.4, "mute": False, "fx": {"reverb": 0.2}},
        },
        "prodLanes": [{"id": "t-audio01", "name": "Pad", "color": "#7aa2ff", "role": "audio"}],
    }
    res = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert res.status_code == 200, res.text
    names = {c["name"] for c in client.get(f"/api/projects/{pid}").json()["mixer_channels"]}
    assert "t-audio01" in names
    again = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert again.status_code == 200, again.text


def test_persist_arrange_clip_edits(client):
    pid = client.post("/api/projects", json={"name": "Clips"}).json()["id"]
    graph = {
        "arrangeZoom": 2,
        "arrangeSnap": 0.25,
        "timeline": {
            "clips": [
                {
                    "id": "c-fade",
                    "trackId": "synth",
                    "name": "Bass",
                    "startBar": 0.25,
                    "lengthBars": 4,
                    "color": "#3dfff3",
                    "kind": "audio",
                    "fadeInBars": 0.25,
                    "fadeOutBars": 0.5,
                }
            ]
        },
    }
    res = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert res.status_code == 200, res.text
    saved = client.get(f"/api/projects/{pid}").json()["graph"]
    assert saved["arrangeZoom"] == 2
    assert saved["arrangeSnap"] == 0.25
    clip = saved["timeline"]["clips"][0]
    assert clip["startBar"] == 0.25
    assert clip["fadeInBars"] == 0.25
    assert clip["fadeOutBars"] == 0.5


def test_persist_session_extra_lane(client):
    pid = client.post("/api/projects", json={"name": "Session lanes"}).json()["id"]
    graph = {
        "prodLanes": [{"id": "t-audio01", "name": "Pad", "color": "#7aa2ff", "role": "audio"}],
        "session": [
            {
                "id": "t-audio01-0",
                "trackId": "t-audio01",
                "scene": 0,
                "name": "Pad loop",
                "kind": "audio",
                "lengthBars": 8,
                "color": "#7aa2ff",
                "empty": False,
                "audioFileId": None,
            }
        ],
    }
    res = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert res.status_code == 200, res.text
    saved = client.get(f"/api/projects/{pid}").json()["graph"]
    assert saved["prodLanes"][0]["id"] == "t-audio01"
    slot = next(c for c in saved["session"] if c["trackId"] == "t-audio01" and c["scene"] == 0)
    assert slot["name"] == "Pad loop"
    assert slot["empty"] is False
