from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import DrumKit, EffectPreset, User

router = APIRouter(prefix="/presets", tags=["presets"])


class PresetIn(BaseModel):
    name: str
    effect_type: str = "fx"
    params: dict[str, Any] = Field(default_factory=dict)


class KitIn(BaseModel):
    name: str
    pads: list[dict[str, Any]] = Field(default_factory=list)


class MidiMapIn(BaseModel):
    name: str = "Controller"
    bindings: dict[str, Any] = Field(default_factory=dict)


@router.get("/effects")
def list_effects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(EffectPreset).filter(or_(EffectPreset.user_id == user.id, EffectPreset.user_id.is_(None))).all()
    if not rows:
        rows = _seed_fx(db, user.id)
    return [{"id": r.id, "name": r.name, "effect_type": r.effect_type, "params": r.params} for r in rows]


@router.post("/effects")
def save_effect(payload: PresetIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = EffectPreset(user_id=user.id, name=payload.name, effect_type=payload.effect_type, params=payload.params)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "params": row.params}


@router.get("/kits")
def list_kits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(DrumKit).filter(or_(DrumKit.user_id == user.id, DrumKit.user_id.is_(None))).all()
    if not rows:
        rows = _seed_kits(db)
    return [{"id": r.id, "name": r.name, "pads": r.pads} for r in rows]


@router.post("/kits")
def save_kit(payload: KitIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = DrumKit(user_id=user.id, name=payload.name, pads=payload.pads)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "pads": row.pads}


@router.get("/midi")
def list_midi(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(EffectPreset)
        .filter(EffectPreset.effect_type == "midi_map", or_(EffectPreset.user_id == user.id, EffectPreset.user_id.is_(None)))
        .all()
    )
    if not rows:
        row = EffectPreset(
            user_id=None,
            name="Pioneer-ish",
            effect_type="midi_map",
            params=default_midi_map(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        rows = [row]
    return [{"id": r.id, "name": r.name, "bindings": r.params} for r in rows]


@router.post("/midi")
def save_midi(payload: MidiMapIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = EffectPreset(user_id=user.id, name=payload.name, effect_type="midi_map", params=payload.bindings)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "bindings": row.params}


@router.delete("/effects/{preset_id}")
def delete_effect(preset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(EffectPreset, preset_id)
    if not row or row.user_id is None or row.user_id != user.id:
        raise HTTPException(404, "Preset not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def default_midi_map() -> dict:
    return {
        "cc": {
            "7": "master.volume",
            "8": "crossfader",
            "10": "A.pan",
            "11": "B.pan",
            "13": "crossfader",
            "16": "A.volume",
            "17": "B.volume",
            "19": "A.eq.low",
            "20": "A.filter",
            "21": "B.filter",
            "23": "B.eq.low",
        },
        "notes": {
            str(36 + i): f"pad:{name}"
            for i, name in enumerate(
                (
                    "kick",
                    "snare",
                    "hat",
                    "clap",
                    "perc",
                    "ride",
                    "tom",
                    "fx",
                    "kick2",
                    "snare2",
                    "ohat",
                    "rim",
                    "shaker",
                    "cowbell",
                    "stab",
                    "vox",
                )
            )
        },
    }


def _seed_kits(db: Session) -> list[DrumKit]:
    pads = [
        {"id": n, "gain": 1.0}
        for n in (
            "kick",
            "snare",
            "hat",
            "clap",
            "perc",
            "ride",
            "tom",
            "fx",
            "kick2",
            "snare2",
            "ohat",
            "rim",
            "shaker",
            "cowbell",
            "stab",
            "vox",
        )
    ]
    row = DrumKit(user_id=None, name="808 Core", pads=pads)
    db.add(row)
    db.commit()
    return [row]


def _seed_fx(db: Session, user_id: str) -> list[EffectPreset]:
    seeds = [
        ("Hall", "reverb", {"reverb": 0.45, "delay": 0.1}),
        ("Tape Echo", "delay", {"delay": 0.55, "feedback": 0.4}),
        ("Club Crush", "bitcrush", {"bitcrush": 0.35, "distortion": 0.2}),
        ("Wash", "fx", {"reverb": 0.3, "flanger": 0.25, "delay": 0.2}),
    ]
    rows = []
    for name, kind, params in seeds:
        row = EffectPreset(user_id=None, name=name, effect_type=kind, params=params)
        db.add(row)
        rows.append(row)
    db.commit()
    return rows
