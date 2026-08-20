def test_owner_isolation(client):
    a = client.post("/api/auth/register", json={"email": "a@test.local", "name": "A", "password": "secret"}).json()
    b = client.post("/api/auth/register", json={"email": "b@test.local", "name": "B", "password": "secret"}).json()
    ha = {"Authorization": f"Bearer {a['access_token']}"}
    hb = {"Authorization": f"Bearer {b['access_token']}"}

    proj = client.post("/api/projects", json={"name": "A private"}, headers=ha).json()
    pid = proj["id"]
    assert client.get(f"/api/projects/{pid}", headers=ha).status_code == 200
    assert client.get(f"/api/projects/{pid}", headers=hb).status_code == 404
    assert client.put(f"/api/projects/{pid}", json={"bpm": 99}, headers=hb).status_code == 404
    assert client.delete(f"/api/projects/{pid}", headers=hb).status_code == 404
    assert client.post(f"/api/ai/actions/apply", json={"project_id": pid, "actions": []}, headers=hb).status_code == 404
    listed = client.get("/api/projects", headers=hb).json()
    assert all(p["id"] != pid for p in listed)


def test_cannot_delete_global_fx(client):
    rows = client.get("/api/presets/effects").json()
    seeded = rows[0]["id"]
    assert client.delete(f"/api/presets/effects/{seeded}").status_code == 404
    mine = client.post("/api/presets/effects", json={"name": "Mine", "effect_type": "fx", "params": {"delay": 0.2}})
    assert mine.status_code == 200
    assert client.delete(f"/api/presets/effects/{mine.json()['id']}").status_code == 200


def test_anthropic_provider_is_selected(monkeypatch):
    from app.config import Settings

    monkeypatch.setattr(
        "ai_agents.orchestrator.get_settings",
        lambda: Settings(ai_provider="anthropic", anthropic_api_key="sk-ant-test"),
    )
    from ai_agents.orchestrator import get_provider

    assert get_provider().name == "anthropic"
