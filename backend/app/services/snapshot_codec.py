"""Gzip-wrap large snapshot graphs so SQLite does not store 30 raw copies."""

from __future__ import annotations

import base64
import gzip
import json
from typing import Any

PACK_KEY = "__fd_gzip__"
MIN_PACK_BYTES = 2048


def pack_graph(graph: dict[str, Any] | None) -> dict[str, Any]:
    data = graph if isinstance(graph, dict) else {}
    if PACK_KEY in data:
        return data
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    if len(raw) < MIN_PACK_BYTES:
        return data
    packed = base64.b64encode(gzip.compress(raw, compresslevel=6)).decode("ascii")
    return {PACK_KEY: packed}


def unpack_graph(graph: dict[str, Any] | None) -> dict[str, Any]:
    data = graph if isinstance(graph, dict) else {}
    blob = data.get(PACK_KEY)
    if not isinstance(blob, str) or not blob:
        return data
    try:
        raw = gzip.decompress(base64.b64decode(blob))
        out = json.loads(raw.decode("utf-8"))
        return out if isinstance(out, dict) else {}
    except Exception:
        return data
