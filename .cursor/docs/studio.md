# Студия (продукт)

Кратко, что видит пользователь. Для UX-правок этого достаточно; звуковой граф — [audio-engine.md](audio-engine.md).

## Режимы (TopBar)

**DJ** — две деки как у CDJ, vinyl platter, waveform overview+zoom, cue/hotcues, loop in/out, loop roll, Rubber Band key lock, beat jump, quantize, slip, sync, **instant doubles**, **crossfader curve**, **EQ kills**, **gain match**, **beat offset / Q-sync**, **echo out**, EQ3, filter, FX, pan/mute/solo, **PFL/CUE**, sidechain, stem rack, crate/queue auto-advance, поиск/сортировка library, drag трека на деку.

**Session** — clip launcher, 8 сцен (drums / synth / audio). Петлю из library можно бросить на слот — она играет в BPM проекта (warp). **Session rec** (TopBar) пишет запущенные сцены на Arrange; **Capture to arrange** снимает текущие клипы на плейхед.

**Arrange** — клипы на таймлайне, automation lanes (filter, EQ, volume). Audio-клипы варпаются в BPM проекта; бейдж BPM/key, кнопка **Key** = transpose в `musical_key`. Drop петли или стема на дорожку.

**Drums** — 16 падов, 16/32/64 шага, paint по сетке (как Channel Rack), graph editor velocity, fill 1/4·1/8·all·offbeat, сдвиг << >>, humanize, swing, save pattern/kit, edit lock в коллабе. Shift-клик по имени пада — mute. Клик по паду выбирает ряд для graph editor.

**Synth** — OSC, ADSR, filter, LFO, **piano roll как в FL** (карандаш с длиной, select/marquee, штамп аккордов, подсветка гаммы, snap, velocity, quantize/humanize, **Arp/Strum**, банк паттернов + **ghost-ноты**), Web MIDI + learn.

**Sampler** — trim/reverse/loop/pitch, slice to pads, split stems. Готовые стемы тащатся на пады или Arrange.

В TopBar рядом с BPM — **тональность** проекта (`musical_key`). Она кормит подсветку гаммы на piano roll, AI bass/melody/chords и clip **Key follow**. **Session rec** пишет clip launcher на Arrange.

Справа **AI Producer** + вкладка Room. Панель AI, library и fullscreen дек прячутся кнопками в TopBar (`Hide AI` / `Hide lib` / `Decks`). Язык **RU/EN** переключается в TopBar (студия) и в шапке Shell (остальные страницы); выбор пишется в `fd_locale`. **Выключить** (TopBar и шапка Shell) спрашивает подтверждение, закрывает терминалы лаунчера и гасит API+UI.

## Library

Поиск по имени / BPM / Camelot. Сортировка: недавно добавленные, имя, BPM, Camelot. Карточки: BPM, key, Camelot, **energy 1–10**, mix-in / mix-out. Mint-рамка — Camelot с Deck A. В crate следующий трек подсвечивается mint (**next**) по Camelot + близости energy. Drag карточки или пункта crate на деку A/B, на слот Session или дорожку Arrange. Drop файла в library по-прежнему upload.

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
| Y | Sync выбранной к другой (BPM) |
| Shift+Y | Quantize sync: BPM + фаза бита к другой деке |
| D / Shift+D | Instant double на другую деку / наоборот |
| G | Match gain выбранной к другой |
| O | Echo out выбранной |
| Z X V | EQ kill low / mid / high (удержание) |
| K | Key lock |
| F | PFL выбранной |
| T | Tap tempo |
| ? | Карта клавиш |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Z | Undo |
| Esc | Закрыть карту / выйти из fullscreen дек |

Pitch range на деке: ±8 / ±16 / ±100. Zoom и key lock запоминаются на трек в `graph.trackView`.

## Микс-инструменты DJ

**Instant doubles** — копирует трек, playhead, pitch и key lock с выбранной деки на другую (кнопки A→B / B→A). Тост при успехе.

**Crossfader curve** — Smooth (equal-power), Sharp (узкий overlap в центре), Cut (оба канала открыты до краёв, scratch). Кривая в `Mixer.setCrossfader`, сохраняется в `graph.xfaderCurve`.

**EQ kills** — isolator kill low/mid/high на канале (клик = toggle, удержание / Z X V = momentary). Кнопка **K** красная, когда kill включён.

**Match gain** — подгоняет trim выбранной деки к loudness другой (`analysis.loudness_db` / RMS / peak). Gain клампится ±12 dB и по peak, чтобы не клиппить.

**Offset / Q-sync** — на микшере сдвиг Deck B относительно A (мс и доли бита по beatgrid). **Q-sync** делает `syncToBpm` и seek не-мастер деки к ближайшей фазе бита другой. Новый timestretch не добавлялся.

**Echo out** — поднимает delay/reverb wet, глушит вход в FX (`ChannelStrip.fxSend`), хвост играет, затем mute + pause. **Только live**; bounce снимает strip как есть и не проигрывает этот жест 1:1.

**FX send / return** — на каналах A/B (и drums/synth) ручки Send rev / Send dly в общий return (те же `ReverbFx` / `DelayFx`, 100% wet). Return level на микшере. Bounce идёт через тот же граф.

## Stem rack

После Split stems (офлайн Demucs или HPSS): mute чекбоксы, **ISO** (соло стема). Стем можно тащить на пад сэмплера/drums или на Arrange как audio clip. Не realtime Demucs.

## Горячие клавиши (режим Synth, piano roll)

| Клавиша | Действие |
| --- | --- |
| Карандаш / drag | Длина ноты |
| Штамп + клик | Аккорд от этой высоты |
| Del / Backspace | Удалить выбранные |
| Ctrl/Cmd+A | Выбрать все |
| Ctrl/Cmd+D | Дублировать блок |
| Ctrl/Cmd+C / V | Копировать / вставить от playhead |
| Стрелки | Сдвиг по сетке / по полутону (Shift = октава) |
| Arp / Strum | Кнопки на ролле: арпеджио или раскачка аккорда (по выделению, иначе все ноты) |
| Ghost + Alt-клик | Скопировать ноту с другого паттерна |
| + / × у Pattern | Новый пустой паттерн / удалить текущий (Ctrl/Cmd+Z) |

A S D F G H J K по-прежнему играют белые клавиши синтеза, если нет Ctrl/Cmd/Alt.

## Demo

Первый проект получает `ForgeDeck Demo Loop.wav` на Deck A. Первый pointerdown резюмит AudioContext и играет демо. На `/` — список недавних проектов.
