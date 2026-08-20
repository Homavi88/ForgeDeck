from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Swap mock → OpenAI / Anthropic / Gemini / local without changing tools."""

    name: str = "base"

    @abstractmethod
    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        """Return {message, actions, reasoning}."""
