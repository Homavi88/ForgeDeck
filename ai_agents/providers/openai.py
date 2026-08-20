"""Optional real-LLM adapter. Falls back to mock if the HTTP call fails."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ai_agents.providers.base import LLMProvider
from ai_agents.providers.mock import MockProducer
from app.config import get_settings

SYSTEM = """You are PulseForge AI Producer, a DJ/DAW copilot.
Reply ONLY with JSON: {"message": string, "actions": [object], "reasoning": string}.
Allowed action types: analyze_audio, create_cue_point, create_loop, create_drum_pattern,
create_synth_preset, suggest_transition, apply_mixer_settings, create_arrangement,
apply_automation, export_mix, suggest_compatible_tracks, create_bassline, create_melody,
create_chord_progression, separate_stems.
Times are seconds. Mixer EQ is dB. Filter knob is -1..1.
"""


class OpenAICompatibleProvider(LLMProvider):
    name = "openai"

    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        fallback = MockProducer()
        if not settings.openai_api_key:
            return fallback.complete(prompt, context)
        payload = {
            "model": settings.ai_model if settings.ai_model != "mock-producer-v1" else "gpt-4o-mini",
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": json.dumps({"prompt": prompt, "context": _slim(context)}, ensure_ascii=False)[:12000],
                },
            ],
            "response_format": {"type": "json_object"},
        }
        try:
            res = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=payload,
                timeout=45.0,
            )
            res.raise_for_status()
            text = res.json()["choices"][0]["message"]["content"]
            data = json.loads(text)
            return {
                "message": data.get("message", ""),
                "actions": data.get("actions") or [],
                "reasoning": data.get("reasoning"),
            }
        except Exception:
            return fallback.complete(prompt, context)


def _slim(context: dict[str, Any]) -> dict[str, Any]:
    project = context.get("project") or {}
    analysis = context.get("analysis") or {}
    return {
        "project_id": context.get("project_id"),
        "bpm": project.get("bpm") or analysis.get("bpm"),
        "key": project.get("musical_key") or analysis.get("key"),
        "audio_file_id": context.get("audio_file_id"),
        "deck_a_track_id": context.get("deck_a_track_id"),
        "deck_b_track_id": context.get("deck_b_track_id"),
        "analysis": {
            k: analysis[k]
            for k in ("bpm", "key", "camelot", "duration", "loudness_db")
            if k in analysis
        },
    }
