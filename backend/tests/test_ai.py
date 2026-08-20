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
