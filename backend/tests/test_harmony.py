from app.services.harmony import camelot, compatible_camelot, make_bassline, parse_key


def test_camelot_neighbors():
    assert camelot("A minor") == "8A"
    assert "8B" in compatible_camelot("8A")
    assert "9A" in compatible_camelot("8A")
    assert "7A" in compatible_camelot("8A")
    assert "8A" in compatible_camelot("8A")


def test_bassline_notes():
    notes = make_bassline("A minor", "house")
    assert notes
    assert all("pitch" in n and "startStep" in n for n in notes)
    tonic, mode = parse_key("A minor")
    assert tonic == "A" and mode == "minor"
