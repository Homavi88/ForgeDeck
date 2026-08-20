from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import DrumKit, EffectPreset, User
from app.services.style_packs import EXTRA_FX, KIT_NAMES, get_style_pack, list_style_packs

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


@router.get("/styles")
def list_styles():
    return list_style_packs()


@router.get("/styles/{pack_id}")
def get_style(pack_id: str):
    pack = get_style_pack(pack_id)
    if not pack:
        raise HTTPException(404, "Style pack not found")
    return pack


@router.get("/effects")
def list_effects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_global_presets(db)
    rows = (
        db.query(EffectPreset)
        .filter(
            EffectPreset.effect_type != "midi_map",
            or_(EffectPreset.user_id == user.id, EffectPreset.user_id.is_(None)),
        )
        .all()
    )
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
    ensure_global_presets(db)
    rows = db.query(DrumKit).filter(or_(DrumKit.user_id == user.id, DrumKit.user_id.is_(None))).all()
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
    ensure_global_presets(db)
    rows = (
        db.query(EffectPreset)
        .filter(
            EffectPreset.effect_type == "midi_map",
            or_(EffectPreset.user_id == user.id, EffectPreset.user_id.is_(None)),
        )
        .all()
    )
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


def _kit_pads() -> list[dict[str, Any]]:
    return [
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


def ensure_global_presets(db: Session) -> None:
    """Idempotent factory seeds so existing SQLite DBs still pick up new packs."""
    have_fx = {
        r.name
        for r in db.query(EffectPreset).filter(EffectPreset.user_id.is_(None), EffectPreset.effect_type != "midi_map")
    }
    added = False
    for name, kind, params in EXTRA_FX:
        if name in have_fx:
            continue
        db.add(EffectPreset(user_id=None, name=name, effect_type=kind, params=params))
        added = True

    midi = (
        db.query(EffectPreset)
        .filter(EffectPreset.user_id.is_(None), EffectPreset.effect_type == "midi_map")
        .first()
    )
    if midi is None:
        db.add(EffectPreset(user_id=None, name="Pioneer-ish", effect_type="midi_map", params=default_midi_map()))
        added = True

    have_kits = {r.name for r in db.query(DrumKit).filter(DrumKit.user_id.is_(None))}
    pads = _kit_pads()
    for name in KIT_NAMES:
        if name in have_kits:
            continue
        db.add(DrumKit(user_id=None, name=name, pads=pads))
        added = True

    if added:
        db.commit()


def _seed_kits(db: Session) -> list[DrumKit]:
    ensure_global_presets(db)
    return db.query(DrumKit).filter(DrumKit.user_id.is_(None)).all()


def _seed_fx(db: Session, user_id: str) -> list[EffectPreset]:
    ensure_global_presets(db)
    return (
        db.query(EffectPreset)
        .filter(EffectPreset.user_id.is_(None), EffectPreset.effect_type != "midi_map")
        .all()
    )
