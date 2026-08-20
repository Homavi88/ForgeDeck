from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ai_agents.providers.mock import MockProducer
from ai_agents.tools import TOOL_REGISTRY, ToolError
from app.config import get_settings
from app.models import AudioFile, Project

settings = get_settings()


def get_provider():
    settings = get_settings()
    if settings.ai_provider in {"openai", "openai-compatible"} and settings.openai_api_key:
        from ai_agents.providers.openai import OpenAICompatibleProvider

        return OpenAICompatibleProvider()
    if settings.ai_provider == "anthropic" and settings.anthropic_api_key:
        from ai_agents.providers.anthropic import AnthropicProvider

        return AnthropicProvider()
    return MockProducer()


class AgentOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.provider = get_provider()

    def build_context(self, project_id: str | None, extra: dict[str, Any]) -> dict[str, Any]:
        context: dict[str, Any] = dict(extra)
        if project_id:
            project = self.db.get(Project, project_id)
            if project:
                context["project_id"] = project.id
                context["project"] = {
                    "id": project.id,
                    "name": project.name,
                    "bpm": project.bpm,
                    "musical_key": project.musical_key,
                    "graph": project.graph,
                }
        file_id = extra.get("audio_file_id") or extra.get("track_id")
        if file_id:
            audio = self.db.get(AudioFile, file_id)
            if audio and audio.analysis:
                context["analysis"] = audio.analysis
                context["audio_file_id"] = audio.id
        return context

    def chat(self, message: str, project_id: str | None, extra: dict[str, Any]) -> dict[str, Any]:
        context = self.build_context(project_id, extra)
        result = self.provider.complete(message, context)
        return {
            "message": result.get("message", ""),
            "actions": result.get("actions", []),
            "reasoning": result.get("reasoning"),
            "provider": self.provider.name,
        }

    def apply_actions(self, project_id: str, actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        applied = []
        for action in actions:
            action_type = action.get("type")
            fn = TOOL_REGISTRY.get(action_type)
            if not fn:
                applied.append({"type": action_type, "ok": False, "error": "Unknown tool"})
                continue
            params = {k: v for k, v in action.items() if k != "type"}
            if "project_id" not in params:
                params["project_id"] = project_id
            if action_type in {
                "create_drum_pattern",
                "create_synth_preset",
                "create_arrangement",
                "apply_mixer_settings",
                "export_mix",
                "suggest_compatible_tracks",
                "create_bassline",
                "create_melody",
                "create_chord_progression",
            }:
                params["project_id"] = project_id
            if action_type == "separate_stems" and "file_id" not in params:
                params["file_id"] = params.get("track_id") or params.get("audio_file_id")
            if action_type == "export_mix" and "fmt" not in params:
                params["fmt"] = params.pop("format", "wav")
            try:
                result = fn(self.db, **_filter_kwargs(fn, params))
                applied.append({"type": action_type, "ok": True, "result": result})
            except (ToolError, TypeError) as exc:
                applied.append({"type": action_type, "ok": False, "error": str(exc)})
        return applied


def _filter_kwargs(fn, params: dict[str, Any]) -> dict[str, Any]:
    import inspect

    sig = inspect.signature(fn)
    allowed = set(sig.parameters) - {"db"}
    return {k: v for k, v in params.items() if k in allowed}
