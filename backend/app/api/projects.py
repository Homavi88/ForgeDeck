from copy import deepcopy
import json
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import default_graph, get_current_user, require_project, seed_project_studio
from app.models import (
    Arrangement,
    Deck,
    DrumPattern,
    MixerChannel,
    Project,
    ProjectSnapshot,
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
    ProjectSnapshotCreate,
    ProjectSnapshotOut,
    ProjectUpdate,
    RenderJobOut,
    RenderRequest,
    SynthPresetCreate,
    SynthPresetOut,
    TrackCreate,
    TrackOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])
SNAPSHOT_LIMIT = 30


def _record_snapshot(db: Session, project: Project, label: str) -> ProjectSnapshot:
    snapshot = ProjectSnapshot(
        project_id=project.id,
        revision=project.graph_revision,
        label=label,
        graph=deepcopy(project.graph or {}),
    )
    db.add(snapshot)
    db.flush()
    stale = (
        db.query(ProjectSnapshot)
        .filter(ProjectSnapshot.project_id == project.id)
        .order_by(ProjectSnapshot.created_at.desc(), ProjectSnapshot.id.desc())
        .offset(SNAPSHOT_LIMIT)
        .all()
    )
    for old_snapshot in stale:
        db.delete(old_snapshot)
    return snapshot


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
    from app.services.demo_library import attach_demo_to_first_project

    attach_demo_to_first_project(db, user, project)
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
def get_project(project: Project = Depends(require_project)):
    return _serialize_project(project)


@router.get("/{project_id}/snapshots", response_model=list[ProjectSnapshotOut])
def list_snapshots(project: Project = Depends(require_project), db: Session = Depends(get_db)):
    return (
        db.query(ProjectSnapshot)
        .filter(ProjectSnapshot.project_id == project.id)
        .order_by(ProjectSnapshot.created_at.desc(), ProjectSnapshot.id.desc())
        .limit(SNAPSHOT_LIMIT)
        .all()
    )


@router.post("/{project_id}/snapshots", response_model=ProjectSnapshotOut)
def create_snapshot(
    payload: ProjectSnapshotCreate,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    snapshot = _record_snapshot(db, project, payload.label)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.post("/{project_id}/snapshots/{snapshot_id}/restore", response_model=ProjectDetail)
def restore_snapshot(
    snapshot_id: str,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    snapshot = (
        db.query(ProjectSnapshot)
        .filter(ProjectSnapshot.id == snapshot_id, ProjectSnapshot.project_id == project.id)
        .one_or_none()
    )
    if snapshot is None:
        raise HTTPException(404, "Snapshot not found")
    project.graph = deepcopy(snapshot.graph)
    project.graph_revision += 1
    from app.services.project_graph import persist_graph

    persist_graph(db, project, project.graph)
    _record_snapshot(db, project, f"Restored: {snapshot.label}")
    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    payload: ProjectUpdate,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    if payload.expected_revision is not None and payload.expected_revision != project.graph_revision:
        raise HTTPException(
            status_code=409,
            detail={"code": "revision_conflict", "graph_revision": project.graph_revision},
        )
    data = payload.model_dump(exclude_unset=True, exclude={"expected_revision", "snapshot_label"})
    graph_changed = payload.graph is not None and payload.graph != project.graph
    for key, value in data.items():
        setattr(project, key, value)
    if graph_changed:
        project.graph_revision += 1
        from app.services.project_graph import persist_graph

        persist_graph(db, project, payload.graph)
        _record_snapshot(db, project, payload.snapshot_label or "Autosave")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project: Project = Depends(require_project), db: Session = Depends(get_db)):
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/share")
def create_share(project: Project = Depends(require_project), db: Session = Depends(get_db)):
    if not project.share_token:
        project.share_token = secrets.token_urlsafe(18)
        db.add(project)
        db.commit()
        db.refresh(project)
    return {"token": project.share_token, "path": f"/share/{project.share_token}"}


@router.post("/{project_id}/duplicate", response_model=ProjectDetail)
def duplicate_project(project: Project = Depends(require_project), db: Session = Depends(get_db)):
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
def export_project_json(project: Project = Depends(require_project)):
    return _serialize_project(project)


@router.post("/{project_id}/tracks", response_model=TrackOut)
def add_track(
    payload: TrackCreate,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    order = len(project.tracks)
    track = Track(project_id=project.id, order_index=order, **payload.model_dump())
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.post("/{project_id}/mixer/{channel_id}", response_model=dict)
def update_mixer(
    channel_id: str,
    payload: MixerSettings,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    channel = db.get(MixerChannel, channel_id)
    if not channel or channel.project_id != project.id:
        channel = (
            db.query(MixerChannel)
            .filter(MixerChannel.project_id == project.id, MixerChannel.name == channel_id)
            .one_or_none()
        )
    if not channel:
        raise HTTPException(404, "Channel not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(channel, key, value)
    db.commit()
    return {"id": channel.id, "name": channel.name}


@router.post("/{project_id}/patterns", response_model=DrumPatternOut)
def save_pattern(
    payload: DrumPatternCreate,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    from app.services.project_graph import keep_named

    data = payload.model_dump()
    pattern = keep_named(db, DrumPattern, project.id, data["name"])
    if pattern is None:
        pattern = DrumPattern(project_id=project.id, **data)
        db.add(pattern)
    else:
        pattern.length = data["length"]
        pattern.swing = data["swing"]
        pattern.bpm = data["bpm"]
        pattern.steps = data["steps"]
        if data.get("kit_id") is not None:
            pattern.kit_id = data["kit_id"]
    db.commit()
    db.refresh(pattern)
    return pattern


@router.post("/{project_id}/synth-presets", response_model=SynthPresetOut)
def save_synth(
    payload: SynthPresetCreate,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    from app.services.project_graph import keep_named

    data = payload.model_dump()
    preset = keep_named(db, SynthPreset, project.id, data["name"])
    if preset is None:
        preset = SynthPreset(project_id=project.id, **data)
        db.add(preset)
    else:
        preset.params = data["params"]
    db.commit()
    db.refresh(preset)
    return preset


@router.post("/{project_id}/render", response_model=RenderJobOut)
def render_project(
    payload: RenderRequest,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    job = RenderJob(project_id=project.id, format=payload.format, source="server_render", status="queued")
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
        from workers.tasks.render import render_project_task

        threading_job = job.id

        def _run():
            render_project_task(threading_job)

        import threading

        threading.Thread(target=_run, daemon=True).start()
    return job


@router.post("/{project_id}/render/upload", response_model=RenderJobOut)
def upload_offline_render(
    file: UploadFile = File(...),
    source: str = Form("bounce"),
    details: str = Form("{}"),
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    """Accept a browser-produced WAV with its recording/bounce provenance."""
    from app.config import get_settings

    if source not in {"bounce", "live_rec", "session_rec"}:
        raise HTTPException(422, "Unsupported render source")
    try:
        parsed_details = json.loads(details) if details else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(422, "Render details must be JSON") from exc
    if not isinstance(parsed_details, dict):
        raise HTTPException(422, "Render details must be an object")
    settings = get_settings()
    job = RenderJob(
        project_id=project.id,
        format="wav",
        source=source,
        details=parsed_details,
        status="rendering",
        progress=0.5,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    dest = settings.storage_path / "renders" / f"{job.id}.wav"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file.file.read())
    job.output_path = str(dest)
    job.status = "done"
    job.progress = 1.0
    db.commit()
    return job


@router.get("/{project_id}/render/{job_id}/file")
def download_render(job_id: str, project: Project = Depends(require_project), db: Session = Depends(get_db)):
    from pathlib import Path

    from fastapi.responses import FileResponse

    job = db.get(RenderJob, job_id)
    if not job or job.project_id != project.id or not job.output_path:
        raise HTTPException(404, "Render not ready")
    path = Path(job.output_path)
    if not path.exists():
        raise HTTPException(404, "File missing")
    return FileResponse(path, filename=path.name)


@router.get("/{project_id}/render/{job_id}", response_model=RenderJobOut)
def get_render(job_id: str, project: Project = Depends(require_project), db: Session = Depends(get_db)):
    job = db.get(RenderJob, job_id)
    if not job or job.project_id != project.id:
        raise HTTPException(404, "Render job not found")
    return job


@router.put("/{project_id}/decks/{name}")
def assign_deck(
    name: str,
    audio_file_id: str | None = None,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    deck = db.query(Deck).filter(Deck.project_id == project.id, Deck.name == name.upper()).one_or_none()
    if not deck:
        raise HTTPException(404, "Deck not found")
    deck.audio_file_id = audio_file_id
    db.commit()
    return {"id": deck.id, "name": deck.name, "audio_file_id": deck.audio_file_id}


@router.post("/{project_id}/arrangements")
def save_arrangement(
    payload: dict,
    project: Project = Depends(require_project),
    db: Session = Depends(get_db),
):
    arr = Arrangement(
        project_id=project.id,
        name=payload.get("name", "Arrangement"),
        length_bars=payload.get("length_bars", 32),
        structure=payload.get("structure", []),
    )
    db.add(arr)
    db.commit()
    db.refresh(arr)
    return {"id": arr.id, "name": arr.name, "structure": arr.structure}

