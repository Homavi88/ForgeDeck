from fastapi import Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import MixerChannel, Project, User

settings = get_settings()


def get_or_create_demo_user(db: Session) -> User:
    user = db.query(User).filter(User.email == settings.demo_user_email).one_or_none()
    if user:
        return user
    user = User(email=settings.demo_user_email, name=settings.demo_user_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_project_studio(db: Session, project: Project) -> None:
    """Create default decks, mixer channels, and empty graph for a new project."""
    from app.models import Deck, EffectChain

    for name in ("A", "B"):
        db.add(Deck(project_id=project.id, name=name))

    channels = [
        ("Deck A", "deck"),
        ("Deck B", "deck"),
        ("Drums", "drum"),
        ("Synth", "synth"),
        ("Master", "master"),
    ]
    for name, role in channels:
        channel = MixerChannel(project_id=project.id, name=name, role=role, volume=0.85 if role != "master" else 0.9)
        db.add(channel)
        db.flush()
        db.add(
            EffectChain(
                mixer_channel_id=channel.id,
                slots=[
                    {"type": "filter", "enabled": True, "wet": 1.0, "params": {"knob": 0}},
                    {"type": "delay", "enabled": False, "wet": 0.25, "params": {"time": 0.375, "feedback": 0.35}},
                    {"type": "reverb", "enabled": False, "wet": 0.2, "params": {"decay": 1.8}},
                ],
            )
        )

    project.graph = default_graph(project)
    db.add(project)
    db.commit()


def default_graph(project: Project) -> dict:
    return {
        "version": 1,
        "mode": "dj",
        "bpm": project.bpm,
        "transport": {"playing": False, "position": 0, "metronome": False},
        "decks": {
            "A": {"audioFileId": None, "pitch": 0, "volume": 0.8, "hotcues": {}, "loop": None},
            "B": {"audioFileId": None, "pitch": 0, "volume": 0.8, "hotcues": {}, "loop": None},
        },
        "mixer": {
            "crossfader": 0.5,
            "masterVolume": 0.9,
            "channels": {},
        },
        "drums": {
            "length": 16,
            "swing": 0.08,
            "steps": {},
        },
        "synth": default_synth_params(),
        "timeline": {"clips": [], "bars": 32, "zoom": 40},
        "automation": [],
    }


def default_synth_params() -> dict:
    return {
        "oscType": "sawtooth",
        "gain": 0.35,
        "attack": 0.01,
        "decay": 0.18,
        "sustain": 0.55,
        "release": 0.25,
        "cutoff": 1800,
        "resonance": 4,
        "lfoRate": 4.5,
        "lfoDepth": 400,
        "lfoTarget": "filter",
        "poly": True,
        "unison": 1,
    }


def get_current_user(db: Session = Depends(get_db)) -> User:
    return get_or_create_demo_user(db)
