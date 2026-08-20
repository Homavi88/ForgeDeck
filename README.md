# PulseForge

Веб-приложение для DJ-сетов, продакшена и живого исполнения: **2 деки + микшер**, драм-машина, синтезатор, таймлайн и AI Producer.

Realtime-звук идёт **только в браузере** (Web Audio API / AudioWorklet). Python-backend хранит проекты, анализирует аудио, гоняет фоновые задачи и AI-инструменты.

## Стек

| Слой | Технологии |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic |
| DB | SQLite (dev) / PostgreSQL (Docker) |
| Jobs | Redis + Celery (опционально; без Redis анализ в потоке) |
| Audio (offline) | soundfile, numpy, scipy, ffmpeg; librosa опционально |
| Frontend | React 18, TypeScript, Vite, Tailwind, Zustand |
| Engine | Web Audio API, AudioWorklet bitcrusher, Web MIDI |

## Быстрый старт (local, SQLite)

```bash
cp .env.example .env

# Backend
python3 -m pip install -r backend/requirements.txt
cd backend
PYTHONPATH=..:. uvicorn app.main:app --reload --port 8000

# Frontend (другой терминал)
cd frontend
npm install
npm run dev
```

Открой [http://localhost:5173](http://localhost:5173). API-документация: [http://localhost:8000/docs](http://localhost:8000/docs).

Создай проект → открой студию → кликни по UI (браузер разблокирует AudioContext) → загрузи mp3/wav в Library → кинь трек на Deck A/B.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Сервисы: PostgreSQL, Redis, backend `:8000`, Celery worker, frontend `:5173` (nginx).

## Архитектура

```
/backend        FastAPI, модели, REST, WebSocket
/frontend       React UI
  /src/audio-engine   Transport, Deck, Mixer, FX, Drums, Synth, Timeline
/workers        Celery: analyze, render, stems (stub)
/ai_agents      Orchestrator + tools + mock LLM
/storage/audio  файлы для dev
```

Поток загрузки:

1. `POST /api/audio/upload` сохраняет файл
2. Worker считает duration, waveform overview, BPM, beats, key, RMS/peak
3. Frontend рисует waveform + beatgrid и играет через `decodeAudioData`

## Режимы UI

- **DJ** — Deck A / Mixer / Deck B, waveform, cue, hot cues, loop 1–16 bars, pitch, sync, crossfader, 3-band EQ, filter, FX, VU
- **Drums** — 16 падов, step sequencer 16/32/64, swing, velocity
- **Synth** — OSC, ADSR, filter, LFO, клавиатура, Web MIDI
- **Arrange** — клипы на таймлайне, drag / trim / split
- **AI Producer** — чат + preview actions → Apply / Reject

## AI tools

`analyze_audio`, `create_cue_point`, `create_loop`, `create_drum_pattern`, `create_synth_preset`, `suggest_transition`, `apply_mixer_settings`, `create_arrangement`, `export_mix`

Провайдер по умолчанию — **mock** (детерминированный продюсер). Подключение OpenAI/Claude/Gemini — см. `.env.example` (`AI_PROVIDER`).

## Тесты

```bash
cd backend
PYTHONPATH=..:. pytest -q
```

## Ограничения MVP

- Pitch на деке = `playbackRate` (темп и тональность связаны). Key lock — в TODO.
- Stem separation (Demucs) — API-заглушка.
- Render — упрощённый mixdown файлов проекта, не полный граф плагинов.
- Нет полноценного login UI (demo user на старте).

Подробный roadmap: [TODO.md](TODO.md).
