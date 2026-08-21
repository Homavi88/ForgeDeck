def test_list_style_packs(client):
    res = client.get("/api/presets/styles")
    assert res.status_code == 200, res.text
    packs = res.json()
    assert len(packs) >= 10
    ids = [p["id"] for p in packs]
    assert len(ids) == len(set(ids))
    house = next(p for p in packs if p["id"] == "house")
    assert house["drums"]["steps"]["kick"][0] == 1
    assert house["synth"]["oscType"]
    assert "delay" in house["fx"]


def test_style_pack_not_found(client):
    res = client.get("/api/presets/styles/nope")
    assert res.status_code == 404


def test_effects_exclude_midi_maps(client):
    fx = client.get("/api/presets/effects")
    assert fx.status_code == 200
    assert all(row["effect_type"] != "midi_map" for row in fx.json())
    names = {row["name"] for row in fx.json()}
    assert "Hall" in names
    midi = client.get("/api/presets/midi")
    assert midi.status_code == 200
    assert midi.json()[0]["name"] == "Pioneer-ish"
    notes = midi.json()[0]["bindings"]["notes"]
    assert notes["1:0"] == "A.hotcue.1"
    assert notes["2:11"] == "B.play"
