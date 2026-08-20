def test_ai_chat_and_apply(client):
    project = client.post("/api/projects", json={"name": "AI Set"}).json()
    chat = client.post(
        "/api/ai/chat",
        json={
            "project_id": project["id"],
            "message": "Make a house drum pattern",
            "context": {},
        },
    )
    assert chat.status_code == 200, chat.text
    body = chat.json()
    assert body["actions"]
    assert any(a["type"] == "create_drum_pattern" for a in body["actions"])

    preview = client.post(
        "/api/ai/actions/preview",
        json={"project_id": project["id"], "actions": body["actions"]},
    )
    assert preview.json()["ok"] is True

    applied = client.post(
        "/api/ai/actions/apply",
        json={"project_id": project["id"], "actions": body["actions"]},
    )
    assert applied.status_code == 200
    assert applied.json()["ok"] is True
    assert applied.json()["applied"][0]["ok"] is True

    refreshed = client.get(f"/api/projects/{project['id']}").json()
    assert refreshed["drum_patterns"]


def test_ai_bassline_and_compatible(client):
    project = client.post("/api/projects", json={"name": "AI Set 2", "musical_key": "A minor"}).json()
    chat = client.post(
        "/api/ai/chat",
        json={"project_id": project["id"], "message": "Create a bassline in the project key", "context": {}},
    )
    assert chat.status_code == 200
    assert any(a["type"] == "create_bassline" for a in chat.json()["actions"])
    applied = client.post(
        "/api/ai/actions/apply",
        json={"project_id": project["id"], "actions": chat.json()["actions"]},
    )
    assert applied.json()["applied"][0]["ok"] is True
    notes = applied.json()["applied"][0]["result"]["notes"]
    assert notes
