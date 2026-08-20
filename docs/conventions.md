# Соглашения

## Куда класть изменение

| Хочу… | Файл / зона |
| --- | --- |
| Поведение деки (play, loop, key lock) | `frontend/src/audio-engine/Deck.ts`, `rubberband.ts` |
| FX / analog IR | `effects/*`, `analog.ts`, `EffectChain.ts` |
| Чтобы bounce звучал как live | те же классы + `offlineRender.ts` + `stripState.ts` |
| Кнопка на деке / mixer | `components/dj/*`, стейт в `useStudio.ts` |
| Сохранить новое поле проекта | graph в `useStudio.save`, типы в `types/index.ts`, при необходимости `project_graph.py` |
| REST endpoint | `backend/app/api/*.py`, схема в `schemas.py`, owner check через `require_*` |
| Stem split | только `app/services/stems.py` (API и Celery его зовут) |
| AI tool | `ai_agents/tools.py` + `TOOL_REGISTRY` + mock-интент в `providers/mock.py` |
| Collab событие | `useProjectSync.ts` + `app/services/events.py` |
| Документация фичи | этот `docs/` + строка в `CHANGELOG.md` |

## Правила, которые уже ломали продукт

1. **Не играть аудио из Python.** Bounce в браузере; серверный render — запасной путь.
2. **Не подменять Rubber Band WSOLA в README.** WSOLA только fallback, если WASM не встал.
3. **Не писать `stems_engine: demucs`, если отработал HPSS.** Только `demucs-cuda` / `demucs-mps` / `demucs-cpu` / `hpss`.
4. **`/api/audio/compatible` регистрируется до `/{audio_id}`.** Новые литеральные пути — тоже выше параметрических.
5. **Bitcrusher и Rubber Band — worklets.** Offline bounce должен `await mixer.ready()` и грузить тот же processor URL.
6. **Не тащить torch в `requirements.txt`.** GPU Demucs — `requirements-stems.txt`.
7. **rubberband-web — GPL-2.0.** Дистрибуция бинарника наследует GPL.

## Стиль кода

- TypeScript strict, без лишних абстракций.
- Python 3.12, type hints в новом коде.
- Коммиты на английском, повелительное наклонение, одно изменение — одна мысль.
- Ветки агента: `cursor/<имя>-c63c`.

## Документы после фичи

1. Короткий пункт в `CHANGELOG.md` (Unreleased).
2. Если менялся поток (новый endpoint, новый FX в chain) — правка соответствующего `docs/*.md`.
3. Чеклист продукта — `TODO.md`. Идеи UX, ещё не взятые в работу — `docs/roadmap.md`.
