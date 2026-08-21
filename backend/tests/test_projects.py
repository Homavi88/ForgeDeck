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


def test_persist_automation_points(client):
    pid = client.post("/api/projects", json={"name": "Auto"}).json()["id"]
    graph = {
        "automation": [
            {
                "target": "deck_a.volume",
                "points": [{"time": 0, "value": 0.85}, {"time": 8, "value": 0.2}],
            }
        ]
    }
    res = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert res.status_code == 200, res.text
    saved = client.get(f"/api/projects/{pid}").json()["graph"]
    lane = saved["automation"][0]
    assert lane["target"] == "deck_a.volume"
    assert lane["points"][1]["value"] == 0.2


def test_persist_insert_order(client):
    pid = client.post("/api/projects", json={"name": "Inserts"}).json()["id"]
    order = ["delay", "eq", "filter", "compressor", "distortion", "bitcrush", "flanger", "reverb"]
    graph = {"mixer": {"A": {"insertOrder": order, "volume": 0.7}}}
    res = client.put(f"/api/projects/{pid}", json={"graph": graph})
    assert res.status_code == 200, res.text
    saved = client.get(f"/api/projects/{pid}").json()["graph"]
    assert saved["mixer"]["A"]["insertOrder"] == order
    assert saved["mixer"]["A"]["volume"] == 0.7


def test_project_snapshots_and_revision_conflicts(client):
    project = client.post("/api/projects", json={"name": "Versions"}).json()
    pid = project["id"]
    assert project["graph_revision"] == 0

    first = client.put(
        f"/api/projects/{pid}",
        json={
            "graph": {"version": 2, "bpm": 122, "timeline": {"clips": []}},
            "expected_revision": 0,
            "snapshot_label": "First arrangement",
        },
    )
    assert first.status_code == 200, first.text
    assert first.json()["graph_revision"] == 1

    stale = client.put(
        f"/api/projects/{pid}",
        json={"graph": {"version": 2, "bpm": 126}, "expected_revision": 0},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["graph_revision"] == 1

    snapshots = client.get(f"/api/projects/{pid}/snapshots")
    assert snapshots.status_code == 200
    first_snapshot = snapshots.json()[0]
    assert first_snapshot["label"] == "First arrangement"
    assert first_snapshot["graph"]["bpm"] == 122

    manual = client.post(f"/api/projects/{pid}/snapshots", json={"label": "Before change"})
    assert manual.status_code == 200

    second = client.put(
        f"/api/projects/{pid}",
        json={"graph": {"version": 2, "bpm": 128}, "expected_revision": 1},
    )
    assert second.status_code == 200
    assert second.json()["graph_revision"] == 2

    restored = client.post(f"/api/projects/{pid}/snapshots/{first_snapshot['id']}/restore")
    assert restored.status_code == 200, restored.text
    assert restored.json()["graph"]["bpm"] == 122
    assert restored.json()["graph_revision"] == 3


def test_live_recording_render_keeps_provenance(client):
    pid = client.post("/api/projects", json={"name": "Recorded set"}).json()["id"]
    uploaded = client.post(
        f"/api/projects/{pid}/render/upload",
        data={
            "source": "live_rec",
            "details": '{"duration": 12.5, "peak": 0.88, "sampleRate": 48000, "channels": 2}',
        },
        files={"file": ("live.wav", b"RIFF-test", "audio/wav")},
    )
    assert uploaded.status_code == 200, uploaded.text
    body = uploaded.json()
    assert body["source"] == "live_rec"
    assert body["details"]["duration"] == 12.5
    assert body["details"]["sampleRate"] == 48000
