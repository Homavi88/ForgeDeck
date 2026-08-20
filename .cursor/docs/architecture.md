# Архитектура

ForgeDeck — веб DJ/DAW. **Realtime-звук только в браузере** (Web Audio API). Python не играет треки: он хранит проекты, анализирует файлы, режет стемы, гоняет AI и принимает bounce/rec.

```
Browser (Vite / React)
  AudioEngine  →  Mixer / Decks / Drums / Synth  →  speakers + Rec
  Zustand      →  autosave PUT /api/projects/{id}
  WebSocket    →  /ws/projects/{id}?token=

FastAPI :8000
  /api/auth  /api/projects  /api/audio  /api/ai  /api/presets  /api/share
  SQLite (dev) или Postgres (Docker)
  storage/audio  или S3

Celery (опционально, USE_CELERY=true)
  analyze  ·  stems  ·  server render
```

## Граница ответственности

| Задача | Где |
| --- | --- |
| Play, pitch, key lock, EQ, FX, drums, synth, bounce | `frontend/src/audio-engine/` |
| UI knobs, режимы, library, AI chat | `frontend/src/` |
| Снимок проекта (`graph` JSON) | `projects.graph` + `app/services/project_graph.py` |
| BPM/key/waveform/beatgrid | `backend/app/services/analysis.py` |
| Stems | `backend/app/services/stems.py` |
| AI tools | `ai_agents/` |
| Фоновые джобы | `workers/tasks/` |

Не переносить playback в Python: латентность и модель продукта не те.

## Снимок проекта

Источник правды для студии — JSON `Project.graph`. На save фронт шлёт mixer, decks, drums, notes, clips, synth, queue. Бэкенд кладёт его в `graph` и дублирует куски в таблицы (`DrumPattern` «Main», `SynthPreset` «Current», `MixerChannel`). Новые поля студии добавляй **и** в graph на клиенте, **и** в hydrate, если они нужны API/AI.

## Звук: live vs bounce

Live: `AudioEngine` → `Mixer` (A/B xfader, drums, synth) → master strip → limiter → destination.

Bounce: `offlineRender.ts` строит **тот же** `Mixer` на `OfflineAudioContext`, копирует live strip (EQ/filter/FX/volume/pan) и Rubber Band для key lock.

Подробности: [audio-engine.md](audio-engine.md).

## Auth

JWT Bearer или `?token=` (нужно WebSocket и `<audio>` fetch). Если `REQUIRE_AUTH=false`, без токена подставляется demo-пользователь `producer@forgedeck.local`. Проекты и аудио проверяют `user_id`.

## Имена и брендинг

Продукт — **ForgeDeck**. Репозиторий на GitHub может называться `DJ`; это имя GitHub, не имя приложения. В коде не оставлять PulseForge.
