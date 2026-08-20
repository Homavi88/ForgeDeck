import os
import sys
from pathlib import Path

from celery import Celery

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("pulseforge", broker=redis_url, backend=redis_url)
celery_app.conf.task_routes = {
    "workers.tasks.analyze.*": {"queue": "analysis"},
    "workers.tasks.render.*": {"queue": "render"},
}
celery_app.autodiscover_tasks(["workers.tasks"])
