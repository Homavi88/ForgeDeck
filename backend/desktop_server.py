"""Entrypoint used by the packaged ForgeDeck desktop sidecar."""

from __future__ import annotations

import os

import uvicorn

from app.main import app


def main() -> None:
    host = os.environ.get("FORGEDECK_HOST", "127.0.0.1")
    port = int(os.environ.get("FORGEDECK_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, log_level=os.environ.get("FORGEDECK_LOG_LEVEL", "warning"))


if __name__ == "__main__":
    main()
