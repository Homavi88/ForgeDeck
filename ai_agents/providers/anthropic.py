"""Anthropic Messages API adapter. Falls back to mock if the HTTP call fails."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ai_agents.providers.base import LLMProvider
from ai_agents.providers.mock import MockProducer
from ai_agents.providers.openai import SYSTEM
from app.config import get_settings


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        from ai_agents.providers.openai import _slim

        settings = get_settings()
        fallback = MockProducer()
        if not settings.anthropic_api_key:
            return fallback.complete(prompt, context)
        model = settings.ai_model if settings.ai_model not in {"mock-producer-v1", ""} else "claude-3-5-haiku-latest"
        payload = {
            "model": model,
            "max_tokens": 1024,
            "temperature": 0.4,
            "system": SYSTEM,
            "messages": [
                {
                    "role": "user",
                    "content": json.dumps({"prompt": prompt, "context": _slim(context)}, ensure_ascii=False)[:12000],
                }
            ],
        }
        try:
            res = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=45.0,
            )
            res.raise_for_status()
            blocks = res.json().get("content") or []
            text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
            data = json.loads(text)
            return {
                "message": data.get("message", ""),
                "actions": data.get("actions") or [],
                "reasoning": data.get("reasoning"),
            }
        except Exception:
            return fallback.complete(prompt, context)
