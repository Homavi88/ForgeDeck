# Студия (продукт)

Кратко, что видит пользователь. Для UX-правок этого достаточно; звуковой граф — [audio-engine.md](audio-engine.md).

## Режимы (TopBar)

**DJ** — две деки как у CDJ, vinyl platter, waveform overview+zoom, cue/hotcues, loop in/out, loop roll, Rubber Band key lock, beat jump, quantize, slip, sync, **instant doubles**, **crossfader curve**, **EQ kills**, **gain match**, **beat offset / Q-sync**, **echo out**, EQ3, filter, FX, pan/mute/solo, **PFL/CUE**, sidechain, stem rack, crate/queue auto-advance, поиск/сортировка library, drag трека на деку.

**Session** — clip launcher, 8 сцен на **тех же дорожках, что Arrange** (drums / synth / Deck A/B + `prodLanes`). **+ Audio track** добавляет ряд здесь и канал в Console. Петлю из library можно бросить на слот — она играет в BPM проекта (warp). Сцена запускает **все** ряды на следующем такте. **Session rec** (TopBar) пишет запущенные сцены на Arrange; **Capture to arrange** снимает текущие клипы на плейхед. Внизу та же **Console**, что в Arrange.

**Arrange** — клипы на таймлайне (волна, trim, **fade** треугольники, snap bar/beat/1/8, zoom). Drag на другую дорожку (Alt = копия); Dup / Copy / Paste; Del и Ctrl/Cmd+D/C/V в режиме Arrange. Под клипами **Automation**: рисуешь volume / filter / EQ low по сетке (Alt снимает точки). AI Apply по-прежнему пишет `deck_a.filter.cutoff` и т.д. **+ Audio track** добавляет дорожку и канал консоли. Внизу **Console**: полоски drums/synth/A/B + user tracks, клик открывает **Inserts** (EQ3, Filter, Comp, Drive, Crush, Flange, Delay, Reverb, bypass, **порядок = звук**: ←/→ или drag). Это встроенный Web Audio, не VST. Audio-клипы варпаются в BPM проекта; бейдж BPM/key, кнопка **Key**. Drop петли или стема на дорожку.

**Drums** — 16 падов, 16/32/64 шага, paint по сетке (как Channel Rack), graph editor velocity, fill 1/4·1/8·all·offbeat, сдвиг << >>, humanize, swing, save pattern/kit, **Load style drums** (оригинальный шаблон жанра, только сетка), edit lock в коллабе. Shift-клик по имени пада — mute. Клик по паду выбирает ряд для graph editor.

**Synth** — OSC, ADSR, filter, LFO, **piano roll как в FL** (карандаш с длиной, select/marquee, штамп аккордов, подсветка гаммы, snap, velocity, quantize/humanize, **Arp/Strum**, банк паттернов + **ghost-ноты**), Web MIDI + learn, **Load style synth** (params + ноты из шаблона).

**Sampler** — trim/reverse/loop/pitch, slice to pads, split stems. Готовые стемы тащатся на пады или Arrange.

В TopBar рядом с BPM — **тональность** проекта (`musical_key`). Она кормит подсветку гаммы на piano roll, AI bass/melody/chords и clip **Key follow**. **Session rec** пишет clip launcher на Arrange.

Справа **AI Producer** + вкладка Room. Панель AI, library и fullscreen дек — тогглы во **второй** строке TopBar (`AI` / `Library` / `Decks`, активные подсвечены). Первая строка: режимы (не обрезаются), Play, BPM, тональность, Save / **History** / Rec / Bounce. **History** — точки восстановления graph на сервере (autosave, ручной Save, Pin). Restore сначала пишет «Before restore». Язык **EN/RU** там же; выбор в `fd_locale`. **Выключить** спрашивает подтверждение, закрывает терминалы лаунчера и гасит API+UI.

## Library

Поиск по имени / BPM / Camelot. Сортировка: недавно добавленные, имя, BPM, Camelot. Карточки: BPM, key, Camelot, **energy 1–10**, mix-in / mix-out. Mint-рамка — Camelot с Deck A. В crate следующий трек подсвечивается mint (**next**) по Camelot + близости energy. Drag карточки или пункта crate на деку A/B, на слот Session или дорожку Arrange. Drop файла в library по-прежнему upload.

## Наушники / PFL

Кнопка **CUE** на канале микшера и **PFL** на деке — pre-fader listen (после FX, до mute/volume). Cue mix: master ↔ cue. **Open cue window** — blank popup с тем же headphone `MediaStream` (не новый React/AudioContext). Выход: `selectAudioOutput()` если браузер умеет, иначе список `enumerateDevices` **без** mic `getUserMedia` + `setSinkId`. Если одного выхода: **Split cue** (L = master, R = cue).

Shift+click Play / Cue / PFL / hotcue / loop / key lock на деке — MIDI learn (`channel:note`). Карта по умолчанию Pioneer-ish (ch1=A, ch2=B), не официальный дамп DDJ.

## Экспорт и шаринг

- **Bounce** — offline WAV через полный mixer graph, upload в проект (`source=bounce` + bpm/key), скачивание; тост «Rendering…» / «Bounce ready»
- **Rec** — live с master (+ mic, если включён); HUD: время, peak, размер; upload `source=live_rec` с duration/peak/sampleRate
- **Share** — `POST /api/projects/{id}/share` → `/share/:token` (нужен bounce или rec)
- **History** — Restore points на сервере (не undo в RAM). Последние 30.

Тосты также: autosave «Saved», анализ после upload, прогресс Split stems, загрузка electronic style pack.

Settings (`/settings`): карточки **Electronic styles** (имя, жанр, BPM, key, blurb, Apply) — оригинальные шаблоны ForgeDeck, не лицензированные банки. Apply грузит BPM/key/drums/synth/FX/notes в текущую сессию студии.

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

## Горячие клавиши (режим Arrange)

| Клавиша | Действие |
| --- | --- |
| Клик | Выбрать клип |
| Drag | Сдвиг по сетке; на другую дорожку — смена track |
| Alt-drag | Копия на целевую дорожку / позицию |
| Double-click | Разрезать по playhead (snap) |
| Края / треугольники | Trim / fade in-out |
| Automation lane | Рисовать volume/filter/EQ · Alt снимает точки |
| Del / Backspace | Удалить выбранный |
| Ctrl/Cmd+D | Дублировать сразу после исходного |
| Ctrl/Cmd+C / V | Копировать / вставить на playhead выбранной дорожки |
| ← / → | Сдвиг на один snap |

Не в INPUT. В Synth те же Ctrl+D/C/V относятся к нотам piano roll.

## Demo

Первый проект получает `ForgeDeck Demo Loop.wav` на Deck A. Первый pointerdown резюмит AudioContext и играет демо. На `/` — список недавних проектов.
