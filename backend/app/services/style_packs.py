"""Built-in electronic style packs (original ForgeDeck templates, not third-party banks).

Patterns follow common public genre conventions (four-on-the-floor, 2-step, amen-ish
breaks). Synth/FX values are ours — not copies of Serum/Vital/Ableton factory packs.
"""

from __future__ import annotations

from typing import Any


def _pad(seq: list[float], n: int = 64) -> list[float]:
    row = [0.0] * n
    for i, v in enumerate(seq):
        if i < n:
            row[i] = float(v)
    return row


def _drums(**pads: list[float]) -> dict[str, list[float]]:
    return {name: _pad(seq) for name, seq in pads.items()}


def _note(i: int, pitch: int, start: int, length: int, vel: float = 0.85) -> dict[str, Any]:
    return {
        "id": f"n{i}",
        "pitch": pitch,
        "startStep": start,
        "length": length,
        "velocity": vel,
    }


STYLE_PACKS: list[dict[str, Any]] = [
    {
        "id": "house",
        "name": "Chicago House",
        "genre": "House",
        "bpm": 124,
        "key": "A minor",
        "blurb": "Four-on-the-floor kick, offbeat hats, clap on 2 and 4.",
        "synth": {
            "oscType": "sawtooth",
            "gain": 0.34,
            "attack": 0.005,
            "decay": 0.22,
            "sustain": 0.35,
            "release": 0.12,
            "cutoff": 520,
            "resonance": 6,
            "lfoRate": 0.4,
            "lfoDepth": 80,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 1,
        },
        "fx": {"delay": 0.18, "reverb": 0.16, "flanger": 0.0, "distortion": 0.08, "bitcrush": 0.0, "compressor": 0.35},
        "drums": {
            "length": 16,
            "swing": 0.06,
            "steps": _drums(
                kick=[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                clap=[0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
                hat=[0, 0, 0.65, 0, 0, 0, 0.65, 0, 0, 0, 0.65, 0, 0, 0, 0.65, 0],
                ohat=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.55, 0],
                perc=[0, 0, 0, 0.35, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0.25],
            ),
        },
        "notes": [
            _note(1, 45, 0, 4),
            _note(2, 48, 4, 4),
            _note(3, 52, 8, 4),
            _note(4, 45, 12, 4),
        ],
    },
    {
        "id": "deep-house",
        "name": "Deep House",
        "genre": "House",
        "bpm": 118,
        "key": "D minor",
        "blurb": "Swung hats, soft kick, warm pad bass.",
        "synth": {
            "oscType": "triangle",
            "gain": 0.28,
            "attack": 0.04,
            "decay": 0.35,
            "sustain": 0.5,
            "release": 0.4,
            "cutoff": 380,
            "resonance": 3.5,
            "lfoRate": 0.25,
            "lfoDepth": 120,
            "lfoTarget": "filter",
            "poly": True,
            "unison": 2,
        },
        "fx": {"delay": 0.28, "reverb": 0.38, "flanger": 0.08, "distortion": 0.04, "bitcrush": 0.0, "compressor": 0.22},
        "drums": {
            "length": 16,
            "swing": 0.14,
            "steps": _drums(
                kick=[1, 0, 0, 0, 0.85, 0, 0, 0, 1, 0, 0, 0.4, 0.85, 0, 0, 0],
                clap=[0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
                hat=[0, 0.4, 0.7, 0.35, 0, 0.4, 0.7, 0.35, 0, 0.4, 0.7, 0.35, 0, 0.4, 0.7, 0.3],
                shaker=[0.3, 0, 0.45, 0, 0.3, 0, 0.45, 0, 0.3, 0, 0.45, 0, 0.3, 0, 0.45, 0],
            ),
        },
        "notes": [
            _note(1, 50, 0, 8, 0.7),
            _note(2, 53, 8, 8, 0.65),
        ],
    },
    {
        "id": "techno",
        "name": "Berlin Techno",
        "genre": "Techno",
        "bpm": 132,
        "key": "F minor",
        "blurb": "Driving 16th hats, dry kick, acid-ish saw.",
        "synth": {
            "oscType": "sawtooth",
            "gain": 0.3,
            "attack": 0.001,
            "decay": 0.12,
            "sustain": 0.15,
            "release": 0.08,
            "cutoff": 280,
            "resonance": 10,
            "lfoRate": 6.5,
            "lfoDepth": 420,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 1,
        },
        "fx": {"delay": 0.12, "reverb": 0.1, "flanger": 0.05, "distortion": 0.22, "bitcrush": 0.08, "compressor": 0.45},
        "drums": {
            "length": 16,
            "swing": 0.02,
            "steps": _drums(
                kick=[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                hat=[0.55, 0.35, 0.7, 0.35, 0.55, 0.35, 0.7, 0.35, 0.55, 0.35, 0.7, 0.35, 0.55, 0.35, 0.7, 0.35],
                clap=[0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 0, 0, 0.75, 0, 0, 0],
                perc=[0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0.5, 0],
                rim=[0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0],
            ),
        },
        "notes": [
            _note(1, 41, 0, 2),
            _note(2, 41, 4, 2),
            _note(3, 44, 8, 2),
            _note(4, 41, 12, 2),
        ],
    },
    {
        "id": "trance",
        "name": "Uplifting Trance",
        "genre": "Trance",
        "bpm": 138,
        "key": "C minor",
        "blurb": "Open hats, long supersaw, hall wash.",
        "synth": {
            "oscType": "sawtooth",
            "gain": 0.26,
            "attack": 0.08,
            "decay": 0.3,
            "sustain": 0.7,
            "release": 0.55,
            "cutoff": 2400,
            "resonance": 2.5,
            "lfoRate": 5.2,
            "lfoDepth": 500,
            "lfoTarget": "filter",
            "poly": True,
            "unison": 4,
        },
        "fx": {"delay": 0.42, "reverb": 0.5, "flanger": 0.12, "distortion": 0.05, "bitcrush": 0.0, "compressor": 0.2},
        "drums": {
            "length": 16,
            "swing": 0.04,
            "steps": _drums(
                kick=[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                clap=[0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0],
                hat=[0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0],
                ohat=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0],
                ride=[0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0, 0.35, 0],
            ),
        },
        "notes": [
            _note(1, 48, 0, 4, 0.7),
            _note(2, 51, 4, 4, 0.7),
            _note(3, 55, 8, 4, 0.75),
            _note(4, 58, 12, 4, 0.8),
        ],
    },
    {
        "id": "dnb",
        "name": "Liquid DnB",
        "genre": "Drum & Bass",
        "bpm": 174,
        "key": "G minor",
        "blurb": "32-step break, snare on 3, Reese-ish bass.",
        "synth": {
            "oscType": "sawtooth",
            "gain": 0.32,
            "attack": 0.002,
            "decay": 0.28,
            "sustain": 0.4,
            "release": 0.18,
            "cutoff": 220,
            "resonance": 8,
            "lfoRate": 0.15,
            "lfoDepth": 60,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 2,
        },
        "fx": {"delay": 0.22, "reverb": 0.18, "flanger": 0.0, "distortion": 0.18, "bitcrush": 0.05, "compressor": 0.5},
        "drums": {
            "length": 32,
            "swing": 0.08,
            "steps": _drums(
                kick=[1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 0],
                snare=[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35, 0, 0, 0, 0],
                hat=[0.5, 0.3, 0.65, 0.3] * 8,
                perc=[0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0],
            ),
        },
        "notes": [
            _note(1, 43, 0, 6),
            _note(2, 46, 8, 4),
            _note(3, 43, 16, 6),
            _note(4, 38, 24, 8),
        ],
    },
    {
        "id": "dubstep",
        "name": "Dubstep Wobble",
        "genre": "Dubstep",
        "bpm": 140,
        "key": "E minor",
        "blurb": "Half-time snare, wobble LFO bass.",
        "synth": {
            "oscType": "square",
            "gain": 0.36,
            "attack": 0.001,
            "decay": 0.2,
            "sustain": 0.55,
            "release": 0.15,
            "cutoff": 180,
            "resonance": 12,
            "lfoRate": 8,
            "lfoDepth": 900,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 1,
        },
        "fx": {"delay": 0.15, "reverb": 0.12, "flanger": 0.2, "distortion": 0.4, "bitcrush": 0.12, "compressor": 0.4},
        "drums": {
            "length": 16,
            "swing": 0.05,
            "steps": _drums(
                kick=[1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
                snare=[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                hat=[0, 0, 0.55, 0, 0, 0, 0.55, 0, 0, 0, 0.55, 0, 0, 0, 0.55, 0],
                fx=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0],
            ),
        },
        "notes": [_note(1, 40, 0, 8), _note(2, 40, 8, 8)],
    },
    {
        "id": "ukg",
        "name": "UK Garage",
        "genre": "Garage",
        "bpm": 130,
        "key": "A minor",
        "blurb": "2-step kick/snare skip, shuffled hats.",
        "synth": {
            "oscType": "square",
            "gain": 0.3,
            "attack": 0.003,
            "decay": 0.16,
            "sustain": 0.25,
            "release": 0.1,
            "cutoff": 640,
            "resonance": 5,
            "lfoRate": 1.2,
            "lfoDepth": 90,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 1,
        },
        "fx": {"delay": 0.2, "reverb": 0.22, "flanger": 0.0, "distortion": 0.06, "bitcrush": 0.0, "compressor": 0.3},
        "drums": {
            "length": 16,
            "swing": 0.16,
            "steps": _drums(
                kick=[1, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                snare=[0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0.45, 0],
                hat=[0, 0.5, 0.7, 0.4, 0, 0.5, 0.7, 0.4, 0, 0.5, 0.7, 0.4, 0, 0.5, 0.7, 0.4],
                clap=[0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0],
            ),
        },
        "notes": [
            _note(1, 45, 0, 3),
            _note(2, 48, 6, 2),
            _note(3, 52, 10, 3),
        ],
    },
    {
        "id": "synthwave",
        "name": "Synthwave",
        "genre": "Synthwave",
        "bpm": 100,
        "key": "C minor",
        "blurb": "Gated hats, analog pad, gated reverb clap.",
        "synth": {
            "oscType": "sawtooth",
            "gain": 0.24,
            "attack": 0.12,
            "decay": 0.4,
            "sustain": 0.65,
            "release": 0.7,
            "cutoff": 1600,
            "resonance": 3,
            "lfoRate": 0.35,
            "lfoDepth": 200,
            "lfoTarget": "filter",
            "poly": True,
            "unison": 3,
        },
        "fx": {"delay": 0.35, "reverb": 0.48, "flanger": 0.15, "distortion": 0.08, "bitcrush": 0.04, "compressor": 0.18},
        "drums": {
            "length": 16,
            "swing": 0.0,
            "steps": _drums(
                kick=[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                clap=[0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0],
                hat=[0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0],
                tom=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0.35, 0, 0],
            ),
        },
        "notes": [
            _note(1, 48, 0, 8, 0.6),
            _note(2, 51, 0, 8, 0.5),
            _note(3, 55, 0, 8, 0.5),
            _note(4, 46, 8, 8, 0.6),
            _note(5, 50, 8, 8, 0.5),
            _note(6, 53, 8, 8, 0.5),
        ],
    },
    {
        "id": "ambient",
        "name": "Ambient IDM",
        "genre": "Ambient",
        "bpm": 88,
        "key": "D major",
        "blurb": "Sparse perc, long pad, heavy wash.",
        "synth": {
            "oscType": "sine",
            "gain": 0.22,
            "attack": 0.4,
            "decay": 0.8,
            "sustain": 0.8,
            "release": 1.2,
            "cutoff": 900,
            "resonance": 1.5,
            "lfoRate": 0.12,
            "lfoDepth": 180,
            "lfoTarget": "filter",
            "poly": True,
            "unison": 2,
        },
        "fx": {"delay": 0.45, "reverb": 0.7, "flanger": 0.18, "distortion": 0.0, "bitcrush": 0.06, "compressor": 0.05},
        "drums": {
            "length": 16,
            "swing": 0.1,
            "steps": _drums(
                kick=[0.7, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0],
                perc=[0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.3, 0, 0],
                shaker=[0, 0.2, 0, 0.15, 0, 0.2, 0, 0.15, 0, 0.2, 0, 0.15, 0, 0.2, 0, 0.15],
            ),
        },
        "notes": [
            _note(1, 50, 0, 16, 0.45),
            _note(2, 54, 4, 12, 0.4),
            _note(3, 57, 8, 8, 0.4),
        ],
    },
    {
        "id": "electro",
        "name": "Electro Funk",
        "genre": "Electro",
        "bpm": 126,
        "key": "F# minor",
        "blurb": "808 hats, cowbell, square bass stabs.",
        "synth": {
            "oscType": "square",
            "gain": 0.33,
            "attack": 0.001,
            "decay": 0.1,
            "sustain": 0.2,
            "release": 0.06,
            "cutoff": 1100,
            "resonance": 4,
            "lfoRate": 0,
            "lfoDepth": 0,
            "lfoTarget": "filter",
            "poly": False,
            "unison": 1,
        },
        "fx": {"delay": 0.14, "reverb": 0.08, "flanger": 0.0, "distortion": 0.12, "bitcrush": 0.1, "compressor": 0.28},
        "drums": {
            "length": 16,
            "swing": 0.04,
            "steps": _drums(
                kick=[1, 0, 0, 0.4, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0.7, 0],
                snare=[0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0.4],
                hat=[0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4],
                cowbell=[0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0],
                clap=[0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0],
            ),
        },
        "notes": [
            _note(1, 42, 0, 1),
            _note(2, 42, 3, 1),
            _note(3, 45, 6, 1),
            _note(4, 42, 8, 2),
            _note(5, 47, 12, 2),
        ],
    },
]


EXTRA_FX: list[tuple[str, str, dict[str, float]]] = [
    ("Hall", "reverb", {"reverb": 0.45, "delay": 0.1}),
    ("Tape Echo", "delay", {"delay": 0.55, "feedback": 0.4}),
    ("Club Crush", "bitcrush", {"bitcrush": 0.35, "distortion": 0.2}),
    ("Wash", "fx", {"reverb": 0.3, "flanger": 0.25, "delay": 0.2}),
    ("Club Plate", "reverb", {"reverb": 0.28, "delay": 0.12, "compressor": 0.3}),
    ("Dub Delay", "delay", {"delay": 0.62, "reverb": 0.2, "feedback": 0.5}),
    ("Trance Super", "fx", {"reverb": 0.48, "delay": 0.4, "flanger": 0.14}),
    ("LoFi Crush", "bitcrush", {"bitcrush": 0.5, "distortion": 0.18, "reverb": 0.12}),
    ("Acid Dirt", "distortion", {"distortion": 0.45, "bitcrush": 0.1, "delay": 0.08}),
    ("Pad Space", "reverb", {"reverb": 0.62, "delay": 0.32, "flanger": 0.1}),
]

KIT_NAMES = (
    "808 Core",
    "House Kit",
    "Techno Kit",
    "Break Kit",
    "Garage Kit",
)


def style_pack_public(pack: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": pack["id"],
        "name": pack["name"],
        "genre": pack["genre"],
        "bpm": pack["bpm"],
        "key": pack["key"],
        "blurb": pack["blurb"],
        "synth": pack["synth"],
        "fx": pack["fx"],
        "drums": pack["drums"],
        "notes": pack["notes"],
    }


def list_style_packs() -> list[dict[str, Any]]:
    return [style_pack_public(p) for p in STYLE_PACKS]


def get_style_pack(pack_id: str) -> dict[str, Any] | None:
    for pack in STYLE_PACKS:
        if pack["id"] == pack_id:
            return style_pack_public(pack)
    return None
