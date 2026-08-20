"""Camelot wheel, mix compatibility, and genre MIDI helpers."""

from __future__ import annotations

from typing import Any

CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"]
CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"]
KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# MIDI pitch class of tonic
TONIC = {name: i for i, name in enumerate(KEYS)}


def parse_key(key: str) -> tuple[str, str]:
    parts = (key or "C minor").replace("maj", "major").replace("min", "minor").split()
    tonic = parts[0].replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#")
    mode = "minor" if len(parts) > 1 and "min" in parts[1].lower() else "major"
    if tonic not in TONIC:
        tonic = "C"
    return tonic, mode


def camelot(key: str) -> str:
    tonic, mode = parse_key(key)
    idx = TONIC[tonic]
    return CAMELOT_MINOR[idx] if mode == "minor" else CAMELOT_MAJOR[idx]


def compatible_camelot(code: str) -> set[str]:
    """Same number (relative major/minor) or ±1 on the wheel."""
    if len(code) < 2:
        return {code}
    num = int("".join(ch for ch in code if ch.isdigit()) or "1")
    letter = code[-1]
    other = "B" if letter == "A" else "A"
    neighbors = {
        f"{num}{letter}",
        f"{num}{other}",
        f"{(num % 12) + 1}{letter}",
        f"{12 if num == 1 else num - 1}{letter}",
    }
    return neighbors


def bpm_compatible(a: float, b: float, pct: float = 0.06) -> bool:
    if not a or not b:
        return False
    return abs(a - b) / max(a, b) <= pct or abs(a * 2 - b) / max(a * 2, b) <= pct or abs(a - b * 2) / max(a, b * 2) <= pct


def tonic_midi(key: str, octave: int = 2) -> int:
    tonic, _ = parse_key(key)
    return 12 * (octave + 1) + TONIC[tonic]


def scale_degrees(key: str) -> list[int]:
    tonic, mode = parse_key(key)
    root = TONIC[tonic]
    intervals = [0, 2, 3, 5, 7, 8, 10] if mode == "minor" else [0, 2, 4, 5, 7, 9, 11]
    return [(root + i) % 12 for i in intervals]


def make_bassline(key: str, genre: str = "house") -> list[dict[str, Any]]:
    root = tonic_midi(key, 1)
    fifth = root + 7
    if genre == "dnb":
        pattern = [(0, root, 2), (4, root, 2), (8, fifth, 2), (12, root, 2)]
    elif genre == "hiphop":
        pattern = [(0, root, 4), (8, fifth, 3), (12, root, 2)]
    else:
        pattern = [(0, root, 2), (4, root, 2), (8, root, 2), (12, fifth, 2), (14, root, 2)]
    return [{"pitch": p, "startStep": s, "length": ln, "velocity": 0.9} for s, p, ln in pattern]


def make_melody(key: str, genre: str = "house") -> list[dict[str, Any]]:
    root = tonic_midi(key, 4)
    deg = scale_degrees(key)
    seq = [0, 2, 4, 2, 5, 4, 2, 0] if genre != "techno" else [0, 0, 4, 0, 5, 4, 0, 7]
    notes = []
    for i, d in enumerate(seq):
        notes.append({"pitch": root - (root % 12) + deg[d % 7] + 12, "startStep": i * 2, "length": 2, "velocity": 0.7})
    return notes


def make_chords(key: str) -> list[dict[str, Any]]:
    root = tonic_midi(key, 3)
    deg = scale_degrees(key)
    # i – VI – III – VII (minor) / I – V – vi – IV (major)
    _, mode = parse_key(key)
    prog = [0, 5, 3, 4] if mode == "minor" else [0, 4, 5, 3]
    notes = []
    for bar, d in enumerate(prog):
        triad = [deg[d % 7], deg[(d + 2) % 7], deg[(d + 4) % 7]]
        for pc in triad:
            notes.append(
                {
                    "pitch": root - (root % 12) + pc,
                    "startStep": bar * 4,
                    "length": 4,
                    "velocity": 0.55,
                }
            )
    return notes
