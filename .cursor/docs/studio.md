# Студия (продукт)

Кратко, что видит пользователь. Для UX-правок этого достаточно; звуковой граф — [audio-engine.md](audio-engine.md).

## Режимы (TopBar)

**DJ** — две деки, vinyl platter, waveform overview+zoom, cue/hotcues, loop in/out, loop roll, Rubber Band key lock, beat jump, quantize, slip, sync, EQ3, filter, FX, pan/mute/solo, **PFL/CUE**, sidechain, stem rack, crate/queue auto-advance, поиск/сортировка library, drag трека на деку.

**Session** — clip launcher, 8 сцен (drums / synth / audio).

**Arrange** — клипы на таймлайне, automation lanes (filter, EQ, volume).

**Drums** — 16 падов, 16/32/64 шага, swing, save pattern/kit, edit lock в коллабе.

**Synth** — OSC, ADSR, filter, LFO, piano roll, Web MIDI + learn.

**Sampler** — trim/reverse/loop/pitch, slice to pads, split stems.

Справа **AI Producer** + вкладка Room. Панель AI, library и fullscreen дек прячутся кнопками в TopBar (`Hide AI` / `Hide lib` / `Decks`). **Выключить** (TopBar и шапка Shell) спрашивает подтверждение, закрывает терминалы лаунчера и гасит API+UI.

## Library

Поиск по имени / BPM / Camelot. Сортировка: недавно добавленные, имя, BPM, Camelot. Карточки с mint-рамкой совместимы по Camelot с Deck A (тот же номер ±1 и relative major/minor). Drag карточки или пункта crate на деку A/B — load. Drop файла в library по-прежнему upload.

## Наушники / PFL

Кнопка **CUE** на канале микшера и **PFL** на деке — pre-fader listen (после FX, до mute/volume). Cue mix: master ↔ cue. Второй выход: `setSinkId` на скрытом `<audio>` с headphone bus. Если одного выхода: **Split cue** (L = master, R = cue).

## Экспорт и шаринг

- **Bounce** — offline WAV через полный mixer graph, upload в проект, скачивание; тост «Rendering…» / «Bounce ready»
- **Rec** — live с master (+ mic, если включён); HUD: время, peak, размер
- **Share** — `POST /api/projects/{id}/share` → `/share/:token` (нужен bounce или rec)

Тосты также: autosave «Saved», анализ после upload, прогресс Split stems.

## Горячие клавиши (режим DJ, не в input)

| Клавиша | Действие |
| --- | --- |
| A / B | Выбрать деку |
| Space | Play / pause оба |
| Shift+Space | Play / pause выбранной |
| C / Shift+C | Cue / set cue |
| 1–4 | Hotcue (ставит, если пусто) |
| Q W E R | Loop 1 / 2 / 4 / 8 тактов |
| Shift+Q | Loop off |
| , / . | Beat jump −4 / +4 |
| N / Shift+N | Load next / prev из crate (или library) |
| Y | Sync выбранной к другой |
| K | Key lock |
| F | PFL выбранной |
| T | Tap tempo |
| ? | Карта клавиш |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Z | Undo |
| Esc | Закрыть карту / выйти из fullscreen дек |

Pitch range на деке: ±8 / ±16 / ±100. Zoom и key lock запоминаются на трек в `graph.trackView`.

## Demo

Первый проект получает `ForgeDeck Demo Loop.wav` на Deck A. Первый pointerdown резюмит AudioContext и играет демо. На `/` — список недавних проектов.
