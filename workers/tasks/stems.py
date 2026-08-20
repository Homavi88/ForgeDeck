"""Stem separation stub.

TODO: wire Demucs / Spleeter in a GPU worker. For MVP we return a queued job
so the API surface exists without pulling PyTorch into the default image.
"""

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.stems.separate_stems_task")
def separate_stems_task(audio_file_id: str) -> dict:
    return {
        "audio_file_id": audio_file_id,
        "status": "unimplemented",
        "stems": ["vocals", "drums", "bass", "other"],
        "todo": "Install demucs in a dedicated worker image and write 4 wav stems.",
    }
