# Соглашения

## Куда класть изменение

| Хочу… | Файл / зона |
| --- | --- |
| Поведение деки (play, loop, key lock) | `frontend/src/audio-engine/Deck.ts`, `rubberband.ts` |
| FX / analog IR | `effects/*`, `analog.ts`, `EffectChain.ts` |
| Чтобы bounce звучал как live | те же классы + `offlineRender.ts` + `stripState.ts` |
| Кнопка на деке / mixer | `components/dj/*`, стейт в `useStudio.ts` |
| Подпись в UI (EN/RU) | `frontend/src/i18n/en.ts` + `ru.ts`, в компоненте `t("…")` и `useI18n((s) => s.locale)` |
| Piano roll / гамма / штамп аккордов | `components/synth/PianoRollPanel.tsx`, теория `lib/musicTheory.ts`, операции `lib/pianoRoll.ts`, playback `audio-engine/PianoRoll.ts` |
| Clip warp (BPM/key + markers) | `lib/clipWarp.ts`, `audio-engine/clipPlayback.ts`, Rubber Band как на деке; Arrange diamonds in `TimelinePanel` |
| Arrange clip edit (snap/dup/fade/zoom) | `lib/clipEdit.ts`, `TimelinePanel.tsx`, `useStudio` clip helpers; fade в `clipPlayback.ts` |
| Freeze / flatten / bounce range / lane export / LUFS | `lib/freeze.ts`, `lib/renderSpan.ts`, `lib/loudness.ts`, `audio-engine/wav.ts` + `offlineRender.ts`; store `frozenLanes` / `bounceRange` |
| SMF MIDI | `lib/midiSmf.ts` + piano roll import/export |
| Snapshot gzip / FLAC-MP3 | `backend/app/services/snapshot_codec.py`, `render_convert.py` |
| Mouse automation | `lib/automation.ts`, `applyAutomation.ts`, `components/arrange/AutomationLane.tsx` |
| FX send / return | `ChannelStrip.sendRev/sendDly`, `Mixer.returnRev/returnDly` |
| Channel Rack (drums graph/fill) | `components/drums/DrumMachinePanel.tsx` |
| Electronic style pack | `backend/app/services/style_packs.py` + `GET /api/presets/styles`; apply в `useStudio.applyStylePack`; UI `components/presets/StylePackSelect.tsx` + Settings cards |
| Production mixer / extra arrange tracks | `Mixer.addLane`, `lib/mix.ts`, `components/mix/ProductionMixer.tsx` + `InsertRack.tsx`; graph `prodLanes` + extra `mixer` keys; `insertOrder` + `ChannelStrip.wireInserts` |
| Session rows for those tracks | `ensureSessionClips` в `lib/mix.ts`; `ClipLauncher.trackIds()`; UI `SessionPanel` |
| CDJ-клавиши | `frontend/src/lib/djHotkeys.ts` (только mode=dj) |
| DJ mix math (offset, gain match) | `frontend/src/lib/djMix.ts` |
| PFL / headphones | `ChannelStrip.pflOut`, `Mixer` cue bus, `HeadphonesMonitor`; cue popup `AudioEngine.openCueWindow` (same stream) |
| Сохранить новое поле проекта | graph в `useStudio.save`, типы в `types/index.ts`, при необходимости `project_graph.py` |
| Точка восстановления / revision | `ProjectSnapshot`, `graph_revision`, `PUT expected_revision`; UI `HistoryMenu.tsx` |
| REST endpoint | `backend/app/api/*.py`, схема в `schemas.py`, owner check через `require_*` |
| Выключить приложение | `PowerOffButton` + `app/services/shutdown.py` + `POST /api/shutdown` (localhost) |
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

Это не пожелание: агент и человек обновляют docs **вместе с кодом**. Cursor: `.cursor/rules/docs-sync.mdc` (`alwaysApply`).

1. Короткий пункт в `CHANGELOG.md` (Unreleased).
2. Если менялся поток (новый endpoint, новый FX в chain, новая клавиша) — правка соответствующего `docs/*.md`.
3. Чеклист продукта — `TODO.md`. Идеи UX, ещё не взятые в работу — `docs/roadmap.md`.
