from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import default_graph, get_current_user, seed_project_studio
from app.models import (
    Arrangement,
    Deck,
    DrumPattern,
    MixerChannel,
    Project,
    RenderJob,
    SynthPreset,
    Track,
    User,
)
from app.schemas import (
    DrumPatternCreate,
    DrumPatternOut,
    MixerSettings,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ProjectUpdate,
    RenderJobOut,
    RenderRequest,
    SynthPresetCreate,
    SynthPresetOut,
    TrackCreate,
    TrackOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _serialize_project(project: Project) -> dict:
    return {
        **ProjectOut.model_validate(project).model_dump(),
        "tracks": [
            {
                "id": t.id,
                "name": t.name,
                "kind": t.kind,
                "color": t.color,
                "audio_file_id": t.audio_file_id,
                "muted": t.muted,
                "solo": t.solo,
                "volume": t.volume,
                "pan": t.pan,
                "order_index": t.order_index,
                "clips": [
                    {
                        "id": c.id,
                        "name": c.name,
                        "start_time": c.start_time,
                        "duration": c.duration,
                        "offset": c.offset,
                        "loop": c.loop,
                        "color": c.color,
                        "audio_file_id": c.audio_file_id,
                    }
                    for c in t.clips
                ],
            }
            for t in project.tracks
        ],
        "decks": [
            {
                "id": d.id,
                "name": d.name,
                "audio_file_id": d.audio_file_id,
                "pitch": d.pitch,
                "volume": d.volume,
                "position": d.position,
            }
            for d in project.decks
        ],
        "mixer_channels": [
            {
                "id": ch.id,
                "name": ch.name,
                "role": ch.role,
                "gain": ch.gain,
                "eq_low": ch.eq_low,
                "eq_mid": ch.eq_mid,
                "eq_high": ch.eq_high,
                "filter_knob": ch.filter_knob,
                "pan": ch.pan,
                "mute": ch.mute,
                "solo": ch.solo,
                "volume": ch.volume,
                "fx": ch.effect_chain.slots if ch.effect_chain else [],
            }
            for ch in project.mixer_channels
        ],
        "drum_patterns": [
            {
                "id": p.id,
                "name": p.name,
                "length": p.length,
                "swing": p.swing,
                "bpm": p.bpm,
                "steps": p.steps,
            }
            for p in project.drum_patterns
        ],
        "synth_presets": [{"id": s.id, "name": s.name, "params": s.params} for s in project.synth_presets],
        "arrangements": [
            {"id": a.id, "name": a.name, "length_bars": a.length_bars, "structure": a.structure}
            for a in project.arrangements
        ],
    }


@router.post("", response_model=ProjectDetail)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(user_id=user.id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    seed_project_studio(db, project)
    db.refresh(project)
    return _serialize_project(project)


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _serialize_project(project)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    db.add(project)
    db.commit()
    if payload.graph is not None:
        from app.services.project_graph import persist_graph

        persist_graph(db, project, payload.graph)
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/duplicate", response_model=ProjectDetail)
def duplicate_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    clone = Project(
        user_id=project.user_id,
        name=f"{project.name} Copy",
        description=project.description,
        bpm=project.bpm,
        time_signature=project.time_signature,
        musical_key=project.musical_key,
        graph=deepcopy(project.graph or default_graph(project)),
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    seed_project_studio(db, clone)
    clone.graph = deepcopy(project.graph or clone.graph)
    db.commit()
    db.refresh(clone)
    return _serialize_project(clone)


@router.get("/{project_id}/export")
def export_project_json(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _serialize_project(project)


@router.post("/{project_id}/tracks", response_model=TrackOut)
def add_track(project_id: str, payload: TrackCreate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    order = len(project.tracks)
    track = Track(project_id=project_id, order_index=order, **payload.model_dump())
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.post("/{project_id}/mixer/{channel_id}", response_model=dict)
def update_mixer(project_id: str, channel_id: str, payload: MixerSettings, db: Session = Depends(get_db)):
    channel = db.get(MixerChannel, channel_id)
    if not channel or channel.project_id != project_id:
        channel = (
            db.query(MixerChannel)
            .filter(MixerChannel.project_id == project_id, MixerChannel.name == channel_id)
            .one_or_none()
        )
    if not channel:
        raise HTTPException(404, "Channel not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(channel, key, value)
    db.commit()
    return {"id": channel.id, "name": channel.name}


@router.post("/{project_id}/patterns", response_model=DrumPatternOut)
def save_pattern(project_id: str, payload: DrumPatternCreate, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    pattern = DrumPattern(project_id=project_id, **payload.model_dump())
    db.add(pattern)
    db.commit()
    db.refresh(pattern)
    return pattern


@router.post("/{project_id}/synth-presets", response_model=SynthPresetOut)
def save_synth(project_id: str, payload: SynthPresetCreate, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    preset = SynthPreset(project_id=project_id, **payload.model_dump())
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


@router.post("/{project_id}/render", response_model=RenderJobOut)
def render_project(project_id: str, payload: RenderRequest, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    job = RenderJob(project_id=project_id, format=payload.format, status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)
    from app.config import get_settings

    if get_settings().use_celery:
        try:
            from workers.tasks.render import render_project_task

            render_project_task.delay(job.id)
        except Exception:
            job.status = "queued"
            db.commit()
    else:
        from app.database import SessionLocal
        from workers.tasks.render import render_project_task

        # Inline fallback for local dev without Redis.
        threading_job = job.id

        def _run():
            render_project_task(threading_job)

        import threading

        threading.Thread(target=_run, daemon=True).start()
    return job


@router.get("/{project_id}/render/{job_id}", response_model=RenderJobOut)
def get_render(project_id: str, job_id: str, db: Session = Depends(get_db)):
    job = db.get(RenderJob, job_id)
    if not job or job.project_id != project_id:
        raise HTTPException(404, "Render job not found")
    return job


@router.put("/{project_id}/decks/{name}")
def assign_deck(project_id: str, name: str, audio_file_id: str | None = None, db: Session = Depends(get_db)):
    deck = (
        db.query(Deck)
        .filter(Deck.project_id == project_id, Deck.name == name.upper())
        .one_or_none()
    )
    if not deck:
        raise HTTPException(404, "Deck not found")
    deck.audio_file_id = audio_file_id
    db.commit()
    return {"id": deck.id, "name": deck.name, "audio_file_id": deck.audio_file_id}


@router.post("/{project_id}/arrangements")
def save_arrangement(project_id: str, payload: dict, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    arr = Arrangement(
        project_id=project_id,
        name=payload.get("name", "Arrangement"),
        length_bars=payload.get("length_bars", 32),
        structure=payload.get("structure", []),
    )
    db.add(arr)
    db.commit()
    db.refresh(arr)
    return {"id": arr.id, "name": arr.name, "structure": arr.structure}
