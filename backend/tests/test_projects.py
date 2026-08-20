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
