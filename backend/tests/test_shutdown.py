from unittest.mock import patch


def test_is_local_client():
    from app.services.shutdown import is_local_client

    assert is_local_client("127.0.0.1")
    assert is_local_client("::1")
    assert is_local_client("localhost")
    assert is_local_client("testclient")
    assert is_local_client("::ffff:127.0.0.1")
    assert not is_local_client("192.168.1.50")
    assert not is_local_client("8.8.8.8")
    assert not is_local_client("")
    assert not is_local_client(None)


def test_shutdown_localhost_schedules(client):
    with patch("app.api.system.schedule_shutdown") as sched:
        res = client.post("/api/shutdown")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["stopping"] is True
    sched.assert_called_once()


def test_shutdown_rejects_remote(client):
    with (
        patch("app.api.system.is_local_client", return_value=False),
        patch("app.api.system.schedule_shutdown") as sched,
    ):
        res = client.post("/api/shutdown")
    assert res.status_code == 403
    sched.assert_not_called()
