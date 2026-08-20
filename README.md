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

## Быстрый старт на Windows

В папке [`bat/`](bat/README.txt) — скрипты для двойного клика:

1. Один раз (или сразу `start.bat` — он сам доустановит): **`bat\setup.bat`**
   создаёт `.venv`, копирует `.env`, ставит Python- и npm-зависимости, пишет демо-wav.
2. **`bat\start.bat`** поднимает API и UI в двух окнах и открывает http://127.0.0.1:5173
3. Остановка: закрыть окна или **`bat\stop.bat`**

Нужны Python 3 (галочка Add to PATH) и Node.js LTS. Docker — отдельно: `bat\start-docker.bat`.

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

Логин: [http://localhost:5173/login](http://localhost:5173/login) — demo `producer@pulseforge.local` / `demo` (пока `REQUIRE_AUTH=false`, API принимает и запросы без токена).

Создай проект → открой студию → кликни по UI (браузер разблокирует AudioContext) → загрузи mp3/wav в Library → кинь трек на Deck A/B.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Сервисы: PostgreSQL, Redis, backend `:8000`, Celery worker, frontend `:5173` (nginx).

## Архитектура

```
/backend        FastAPI, модели, REST, WebSocket, JWT, presets
/frontend       React UI
  /src/audio-engine   Transport, Deck, Mixer, FX, Drums, Synth, Timeline
/workers        Celery: analyze, render, stems (Demucs or HPSS)
/ai_agents      Orchestrator + tools + mock LLM
/storage/audio  файлы для dev (опционально S3)
```

Поток загрузки:

1. `POST /api/audio/upload` сохраняет файл (локально, затем S3 если задан bucket)
2. Worker считает duration, waveform overview, BPM, beats, key, RMS/peak
3. Frontend рисует waveform + beatgrid и играет через `decodeAudioData`

## Режимы UI

- **DJ** — деки, vinyl platter/scratch, waveform, cue/hot cues, loop in/out, loop roll, key lock, beat jump, quantize, sync, EQ/filter/FX-пресеты, pan/mute/solo, sidechain
- **Session** — clip launcher на 8 сцен
- **Arrange** — клипы играют drums/synth/audio, automation lanes, mixer
- **Drums** — 16 падов, sequencer 16/32/64, swing, save pattern/kit
- **Synth** — OSC/ADSR/filter/LFO, piano roll, Web MIDI + learn map
- **Sampler** — trim/reverse/loop/pitch, slice to pads, stems
- **AI Producer** — preview → Apply/Reject
- **Settings** — FX presets, MIDI map (Pioneer/Akai-style CC)

## AI tools

`analyze_audio`, `create_cue_point`, `create_loop`, `create_drum_pattern`, `create_synth_preset`, `suggest_transition`, `apply_mixer_settings`, `create_arrangement`, `apply_automation`, `export_mix`, `suggest_compatible_tracks`, `create_bassline`, `create_melody`, `create_chord_progression`, `separate_stems`

Провайдер по умолчанию — **mock**. При `AI_PROVIDER=openai` и `OPENAI_API_KEY` используется OpenAI JSON tool-calling, иначе mock.

## Тесты

```bash
cd backend
PYTHONPATH=..:. pytest -q

cd frontend
npm run build
npx playwright test
```

## Ограничения

- Key lock — granular WSOLA, не Rubber Band WASM.
- Stems — Demucs, если CLI установлен, иначе HPSS.
- Offline export — mix загруженных дек через `OfflineAudioContext`, не полная копия live-графа с плагинами.
- Auth — JWT есть; в dev `REQUIRE_AUTH=false` оставляет demo-пользователя.

Подробный roadmap: [TODO.md](TODO.md).
