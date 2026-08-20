from __future__ import annotations

from typing import Any

from ai_agents.providers.base import LLMProvider

CAMELTONIC = {
    "house": {"bpm": 124, "key": "A minor"},
    "techno": {"bpm": 132, "key": "F minor"},
    "dnb": {"bpm": 174, "key": "G minor"},
    "hiphop": {"bpm": 90, "key": "C minor"},
    "trance": {"bpm": 138, "key": "E minor"},
}


class MockProducer(LLMProvider):
    """Deterministic producer that emits structured DJ/DAW actions.

    Used until a real LLM key is configured. Intent is parsed from keywords
    so the UI/tool pipeline can be developed end-to-end.
    """

    name = "mock"

    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        text = prompt.lower()
        project = context.get("project") or {}
        analysis = context.get("analysis") or {}
        bpm = analysis.get("bpm") or project.get("bpm") or 120
        key = analysis.get("key") or project.get("musical_key") or "C minor"
        track_id = context.get("track_id") or context.get("audio_file_id")
        deck_a = context.get("deck_a_track_id") or track_id
        deck_b = context.get("deck_b_track_id")
        project_id = context.get("project_id") or project.get("id")

        if any(word in text for word in ("transition", "переход", "mix into", "blend")):
            return self._transition(deck_a, deck_b, bpm)
        if any(word in text for word in ("compatible", "camelot", "подбор", "similar track")):
            return {
                "message": f"Ищу треки рядом по Camelot и BPM {bpm:.0f} / {key}.",
                "actions": [{"type": "suggest_compatible_tracks", "project_id": project_id, "bpm": bpm, "key": key}],
            }
        if any(word in text for word in ("stem", "stems", "разделить", "vocals")):
            return {
                "message": "Разделяю на harmonic/percussive stems (HPSS). Vocals здесь — harmonic слой, не полноценный Demucs.",
                "actions": [{"type": "separate_stems", "file_id": track_id}],
            }
        if any(word in text for word in ("bassline", "bass line", "бас-лин")):
            return {
                "message": f"Бас-линия в {key}, жанровый groove на piano roll.",
                "actions": [{"type": "create_bassline", "project_id": project_id, "genre": "house", "key": key}],
            }
        if any(word in text for word in ("melody", "мелодия", "lead line")):
            return {
                "message": f"Мелодия по гамме {key} — 8 нот на 16 шагов.",
                "actions": [{"type": "create_melody", "project_id": project_id, "genre": "house", "key": key}],
            }
        if any(word in text for word in ("chord", "аккорд", "progression", "гармон")):
            return {
                "message": f"Прогрессия аккордов в {key} (4 такта).",
                "actions": [{"type": "create_chord_progression", "project_id": project_id, "key": key}],
            }
        if any(word in text for word in ("drum", "бит", "pattern", "groove")):
            genre = next((g for g in CAMELTONIC if g in text), "house")
            return self._drums(project_id, genre, bpm)
        if any(word in text for word in ("synth", "preset", "bass", "lead")):
            style = "dark bass" if "bass" in text else "supersaw"
            return self._synth(project_id, style)
        if any(word in text for word in ("arrange", "structure", "intro", "drop")):
            return self._arrangement(project_id, bpm)
        if any(word in text for word in ("mix", "eq", "compress", "loudness", "gain")):
            return self._mix(context)
        if any(word in text for word in ("cue", "loop", "hot cue")):
            return self._cues(track_id, bpm)
        if any(word in text for word in ("analyze", "анализ", "bpm", "key")):
            return self._analyze(track_id, bpm, key, analysis)

        return {
            "message": (
                f"Я AI Producer. Проект около {bpm:.0f} BPM, тональность {key}. "
                "Могу предложить переход между деками, драм-паттерн, synth preset, "
                "структуру аранжировки или mix suggestions. Напиши, что сделать, "
                "или нажми быструю команду."
            ),
            "reasoning": "Fallback help message from mock provider.",
            "actions": [],
        }

    def _analyze(self, track_id: str | None, bpm: float, key: str, analysis: dict) -> dict[str, Any]:
        loud = analysis.get("loudness_db")
        extra = f" Громкость ≈ {loud} dBFS." if loud is not None else ""
        return {
            "message": (
                f"Анализ трека: {bpm:.1f} BPM, тональность {key}.{extra} "
                "Рекомендую разметить intro cue, drop и 16-bar loop для DJ-сета."
            ),
            "reasoning": "Used stored analysis + Camelot-friendly cue placement.",
            "actions": [
                {"type": "analyze_audio", "file_id": track_id},
                {
                    "type": "create_cue_point",
                    "track_id": track_id,
                    "time": 0.0,
                    "label": "Intro",
                },
                {
                    "type": "create_cue_point",
                    "track_id": track_id,
                    "time": 32.0 * 60.0 / max(bpm, 1),
                    "label": "Drop",
                },
                {
                    "type": "create_loop",
                    "track_id": track_id,
                    "start": 16.0 * 60.0 / max(bpm, 1),
                    "end": 32.0 * 60.0 / max(bpm, 1),
                    "label": "Phrase loop 16 bars",
                },
            ],
        }

    def _transition(self, deck_a: str | None, deck_b: str | None, bpm: float) -> dict[str, Any]:
        bar = 60.0 / max(bpm, 1) * 4
        t0 = 16 * bar
        t1 = t0 + 8 * bar
        return {
            "message": (
                "Предлагаю 32-тактовый переход: low-pass на Deck A, "
                "постепенный ввод Deck B, лёгкий delay на outgoing деке и EQ cut на low у входящей."
            ),
            "reasoning": "Classic DJ blend: filter + EQ swap + delay send.",
            "actions": [
                {
                    "type": "suggest_transition",
                    "deck_a_track_id": deck_a,
                    "deck_b_track_id": deck_b,
                    "bars": 32,
                },
                {
                    "type": "apply_automation",
                    "target": "deck_a.filter.cutoff",
                    "points": [{"time": t0, "value": 1.0}, {"time": t1, "value": 0.15}],
                },
                {
                    "type": "apply_automation",
                    "target": "deck_a.eq.low",
                    "points": [{"time": t0, "value": 0.0}, {"time": t1, "value": -12.0}],
                },
                {
                    "type": "apply_automation",
                    "target": "deck_b.volume",
                    "points": [{"time": t0, "value": 0.0}, {"time": t1, "value": 0.85}],
                },
                {
                    "type": "apply_mixer_settings",
                    "channel_id": "Deck A",
                    "settings": {"eq_high": -2, "filter_knob": -0.35},
                },
            ],
        }

    def _drums(self, project_id: str | None, genre: str, bpm: float) -> dict[str, Any]:
        patterns = {
            "house": {
                "kick": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                "hat": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                "clap": [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0],
            },
            "techno": {
                "kick": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
                "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                "hat": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                "perc": [0, 0, 0.6, 0, 0, 0, 0.4, 0, 0, 0.5, 0, 0, 0, 0, 0.7, 0],
            },
            "dnb": {
                "kick": [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                "hat": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            },
            "hiphop": {
                "kick": [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.5],
                "hat": [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
            },
        }
        steps = patterns.get(genre, patterns["house"])
        meta = CAMELTONIC.get(genre, {"bpm": bpm})
        return {
            "message": f"Собрал {genre} паттерн на {meta['bpm']} BPM: four-on-the-floor / жанровый groove, swing 8%.",
            "reasoning": "Genre template + velocity accents.",
            "actions": [
                {
                    "type": "create_drum_pattern",
                    "project_id": project_id,
                    "genre": genre,
                    "bpm": meta["bpm"],
                    "swing": 0.08,
                    "length": 16,
                    "steps": steps,
                    "name": f"{genre.title()} Groove",
                }
            ],
        }

    def _synth(self, project_id: str | None, style: str) -> dict[str, Any]:
        presets = {
            "dark bass": {
                "oscType": "sawtooth",
                "cutoff": 280,
                "resonance": 8,
                "attack": 0.01,
                "decay": 0.22,
                "sustain": 0.4,
                "release": 0.18,
                "lfoRate": 0.4,
                "lfoDepth": 80,
                "gain": 0.4,
            },
            "supersaw": {
                "oscType": "sawtooth",
                "cutoff": 2400,
                "resonance": 2.5,
                "attack": 0.08,
                "decay": 0.3,
                "sustain": 0.7,
                "release": 0.4,
                "lfoRate": 5.5,
                "lfoDepth": 600,
                "gain": 0.28,
                "unison": 3,
            },
        }
        params = presets.get(style, presets["supersaw"])
        return {
            "message": f"Пресет «{style}»: {params['oscType']}, cutoff {params['cutoff']} Hz, ADSR под электронный микс.",
            "actions": [
                {
                    "type": "create_synth_preset",
                    "project_id": project_id,
                    "style": style,
                    "name": style.title(),
                    "params": params,
                }
            ],
        }

    def _arrangement(self, project_id: str | None, bpm: float) -> dict[str, Any]:
        structure = [
            {"name": "Intro", "bars": 8, "energy": 0.2},
            {"name": "Buildup", "bars": 8, "energy": 0.55},
            {"name": "Drop", "bars": 16, "energy": 1.0},
            {"name": "Breakdown", "bars": 8, "energy": 0.35},
            {"name": "Drop 2", "bars": 16, "energy": 0.95},
            {"name": "Outro", "bars": 8, "energy": 0.15},
        ]
        return {
            "message": (
                "Структура club track: Intro 8 → Build 8 → Drop 16 → Break 8 → Drop 16 → Outro 8. "
                f"При {bpm:.0f} BPM это около {sum(s['bars'] for s in structure) * 4 * 60 / max(bpm, 1):.0f} секунд."
            ),
            "actions": [
                {
                    "type": "create_arrangement",
                    "project_id": project_id,
                    "structure": structure,
                    "name": "Club Form",
                }
            ],
        }

    def _mix(self, context: dict[str, Any]) -> dict[str, Any]:
        return {
            "message": (
                "Mix notes: держи kick около -8 dBFS peak, обрежь low у мелодических дорожек ниже 120 Hz, "
                "sidechain-like ducking на басу, master limiter ceiling -0.3 dB, цель -9 LUFS для DJ set / -14 LUFS для стриминга."
            ),
            "actions": [
                {
                    "type": "apply_mixer_settings",
                    "channel_id": "Deck A",
                    "settings": {"gain": -1.5, "eq_low": 1.5, "eq_high": -0.5, "volume": 0.8},
                },
                {
                    "type": "apply_mixer_settings",
                    "channel_id": "Deck B",
                    "settings": {"gain": -2.0, "eq_low": -3.0, "eq_mid": 0.5, "volume": 0.75},
                },
                {
                    "type": "apply_mixer_settings",
                    "channel_id": "Master",
                    "settings": {"volume": 0.88},
                },
            ],
        }

    def _cues(self, track_id: str | None, bpm: float) -> dict[str, Any]:
        bar = 60.0 / max(bpm, 1) * 4
        return {
            "message": "Расставил hot cues: intro, break, drop, outro и 8-bar loop.",
            "actions": [
                {"type": "create_cue_point", "track_id": track_id, "time": 0, "label": "Cue 1 Intro", "hotcue_index": 1},
                {"type": "create_cue_point", "track_id": track_id, "time": 8 * bar, "label": "Cue 2 Break", "hotcue_index": 2},
                {"type": "create_cue_point", "track_id": track_id, "time": 16 * bar, "label": "Cue 3 Drop", "hotcue_index": 3},
                {"type": "create_loop", "track_id": track_id, "start": 16 * bar, "end": 24 * bar, "label": "8 bar loop"},
            ],
        }
