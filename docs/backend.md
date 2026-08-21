# Backend

Корень: `backend/app/`. Точка входа `app.main:app`. Префикс REST: `/api`.

## Модули

| Путь | Роль |
| --- | --- |
| `app/main.py` | FastAPI, CORS, ProxyHeaders, lifespan (storage, schema, demo user, `ensure_global_presets`) |
| `app/config.py` | `Settings` из env / `.env` |
| `app/deps.py` | JWT или demo user, `require_project` / `require_audio` |
| `app/models/entities.py` | SQLAlchemy |
| `app/schemas.py` | Pydantic |
| `app/api/` | Роутеры |
| `app/services/` | analysis, stems, storage, object_store, project_graph, security, events, shutdown, **style_packs** |
| `alembic/` | миграции |

## Модели (коротко)

- `User` → `Project`, `AudioFile`
- `Project.graph` — JSON студии; `share_token` для публичной страницы
- `AudioFile.analysis` — JSON: bpm, key, camelot, waveform, beats, stems, `stems_engine`, **energy 1–10**, **mix_in / mix_out** (phrase heuristic)
- `Deck`, `MixerChannel`, `DrumPattern`, `SynthPreset`, `Clip`, `Arrangement`, `CuePoint`, `LoopRegion`, `RenderJob`, `AIConversation`

## REST (практическое)

Auth: `POST /api/auth/register`, `/login`, `GET /api/auth/me`.

Projects: CRUD, `PUT` сохраняет graph (`persist_graph` обновляет **один** DrumPattern `Main` / SynthPreset `Current` / mixer channel по имени — **создаёт** канал для extra `prodLanes` ключей — и удаляет дубли), duplicate, share, export JSON, tracks, patterns (**upsert** по имени), synth-presets (upsert по имени), decks, arrangements, render (+ upload WAV с клиента).

Audio: `POST /upload` (квота), list, `GET /compatible` (**до** `/{id}`), analysis, cues, loops, `POST /{id}/stems`, stream stem.

AI: chat + apply actions (см. [ai.md](ai.md)).

Presets: `GET /api/presets/styles` (10 original electronic packs, no auth), `GET /api/presets/styles/{id}` (404 if missing); effects / kits / midi. `GET /api/presets/effects` **не** отдаёт `midi_map` (Pioneer-ish живёт в `/midi`). `ensure_global_presets` идемпотентно досеивает FX/kits/midi в существующие SQLite. Seeded FX нельзя удалить.

Пакеты стилей (`app/services/style_packs.py`): оригинальные шаблоны ForgeDeck по публичным жанровым условностям (four-on-the-floor, 2-step, half-time). Не копии Serum/Vital/Ableton. Не скачиваются из сети в runtime. Поля: id, name, genre, bpm, key, blurb, synth, fx (wet: delay/reverb/flanger/distortion/bitcrush/compressor; extra keys вроде feedback игнорирует `setWet`), drums `{length, swing, steps}`, notes. 808 Core — первый kit в `KIT_NAMES`.

Share: `GET /api/share/{token}` публично.

Health: `GET /api/health`.

Shutdown: `POST /api/shutdown` — только с loopback (`127.0.0.1`, `::1`, `localhost`). Закрывает окна с заголовком ForgeDeck API/UI/launcher, убивает слушателей :8000 и :5173 (включая parent uvicorn `--reload`), затем `os._exit`. Без JWT: граница безопасности — localhost, не логин. Тесты мокают `schedule_shutdown`, иначе pytest умрёт.

Owner: проект и файл чужого user_id → 404/403. Compatible-search только по библиотеке владельца.

## WebSocket

`/ws/projects/{project_id}?token=`

Токен обязателен (или demo, если `REQUIRE_AUTH=false`). Чужая комната → close 4404.

Типы сообщений (`app/services/events.py`):

| type | Смысл |
| --- | --- |
| `hello` | сервер → клиент, snapshot presence/locks/chat |
| `state` | snapshot студии (bpm, mixer, decks, drums, notes, clips…) |
| `presence` | кто на Deck A/B |
| `chat` | комната, последние 80 |
| `lock` / `unlock` | эксклюзив на `deckA` / `deckB` / drums |
| `room` | рассылка presence+locks+chat |

Клиент: `frontend/src/store/useProjectSync.ts`.

## Jobs

`USE_CELERY=false` (дефолт): анализ в daemon thread.

Иначе Celery (`workers/celery_app.py`):

- `workers.tasks.analyze.analyze_audio_task`
- `workers.tasks.stems.separate_stems_task`
- `workers.tasks.render.render_project_task`

## Stems

Единая функция `separate_stems()` в `app/services/stems.py`:

1. Python Demucs на `select_stems_device()` (cuda → mps → cpu, плюс `STEMS_DEVICE`)
2. CLI `demucs --device`
3. HPSS (`hpss_stems`) — harmonic≈vocals, percussive≈drums

Не импортировать `_try_demucs` из workers в API.

## Storage

Локально `STORAGE_DIR` (по умолчанию `../storage/audio`). Если задан `AWS_S3_BUCKET` — `object_store.py`. Upload ≤ `MAX_UPLOAD_MB`, сумма файлов пользователя ≤ `QUOTA_MB`.

## Тесты

`backend/tests/`. `conftest.py` поднимает SQLite `test_forgedeck.db` и `REQUIRE_AUTH=false`. Не ходить в сеть и не грузить torch в CI: GPU Demucs мокается.
