from app.services.snapshot_codec import PACK_KEY, pack_graph, unpack_graph


def test_small_graph_stays_plain():
    data = {"bpm": 120, "mode": "dj"}
    packed = pack_graph(data)
    assert PACK_KEY not in packed
    assert packed["bpm"] == 120


def test_large_graph_roundtrip():
    data = {"clips": [{"id": f"c{i}", "name": "x" * 40} for i in range(120)]}
    packed = pack_graph(data)
    assert PACK_KEY in packed
    out = unpack_graph(packed)
    assert out["clips"][0]["id"] == "c0"
    assert len(out["clips"]) == 120
    assert unpack_graph(packed)["clips"][-1]["id"] == "c119"
