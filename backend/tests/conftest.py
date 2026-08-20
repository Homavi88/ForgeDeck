import os
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./test_pulseforge.db"
os.environ["STORAGE_DIR"] = str(ROOT / "storage" / "test-audio")
os.environ["USE_CELERY"] = "false"
os.environ["AI_PROVIDER"] = "mock"

from app.config import get_settings

get_settings.cache_clear()

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def _db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def wav_file(tmp_path: Path) -> Path:
    sr = 22050
    t = np.linspace(0, 2.0, int(sr * 2.0), endpoint=False)
    # 120 BPM kick-ish pulse + tone so BPM estimator has periodicity.
    click = np.zeros_like(t)
    period = int(sr * 0.5)
    click[::period] = 1.0
    y = 0.2 * np.sin(2 * np.pi * 110 * t) + 0.4 * click
    path = tmp_path / "loop.wav"
    sf.write(path, y.astype(np.float32), sr)
    return path
