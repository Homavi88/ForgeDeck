# Roadmap (ещё не в коде)

Чеклист уже сделанного продукта: [`TODO.md`](../TODO.md). Здесь — удобства, которые обсуждались и **намеренно не начаты**, чтобы не потерять приоритет.

DJ must-have с клавиатурой, library search, drag на деку, PFL, тостами и hide AI/library — в коде (см. [studio.md](studio.md)). История проекта (restore points) — в коде.

## Продакшен (писать и отдавать трек)

Это не «добавить VST». Браузер не загрузит Serum / FabFilter. Ниже — то, что **можно** довести в Web Audio, чтобы трек доводили до релиза, а не только скетчили.

### Довести микс до файла

- ~~**Freeze / flatten** — drums, synth или audio+inserts в новый WAV-клип на той же дорожке.~~ Arrange toolbar + Console: Freeze / Unfreeze / Flatten. Freeze = insert rack (`ChannelStrip.duck`), не мастер и не send-returns. Unfreeze читает `graph.frozenLanes`.
- ~~**Bounce куска** — цикл / между локаторами.~~ Arrange **from / bars**; пусто = весь микс (как раньше, потолок 8 мин).
- ~~**24-bit / 48 kHz** Bounce~~ (PCM, без dither). Rec live остаётся 16-bit. **Dither** при даунсемпле в 16-bit — ещё нет.
- **Стемы / per-track export** — drums / synth / каждая `prodLane` отдельно, с тем же insert rack. ISO стемов Demucs — не то же самое. Freeze одной дорожки ≠ batch export всех.
- ~~**Rec в дорожку** — mic/line пишет клип на выбранный Arrange lane.~~ Rec по-прежнему пишет master + скачивание; клип падает на `selectedMixId`.
- **Список Bounce/Rec** — `RenderJob.source` + `details` уже есть; в UI нет браузера прошлых файлов, только share последнего.
- **LUFS / true peak** на Bounce (сейчас peak limiter на master, без громкости под стриминг).
- **MP3/FLAC Bounce** для шаринга (share отдаёт WAV). Серверный `render.py` — наивный mix файлов **без** FX, не 1:1.

### Таймлайн как в DAW

- **Локаторы / loop range / skip** на Arrange (есть snap/zoom/fade, нет маркеров куплета-дропа).
- **Tempo map** — смена BPM и размера по тактам; клипы уже warp к *одному* project BPM.
- **Warp-маркеры** на аудио (транзиенты), не только `projectBpm / sourceBpm`.
- **Clip gain / reverse / transpose** отдельно от fade и Key follow.
- **Crossfade** между соседними клипами (сейчас fade только внутри клипа).
- **Automation всего стрипа** — pan, sends, bypass, wet каждого insert. Сейчас мышью: volume / filter / EQ-low. Filter LP↔HP на bounce по-прежнему приближение.
- **Несколько инструментов** — второй synth, второй drum rack, sampler как Arrange-инструмент. Сейчас один synth + один 16-pad kit на весь проект.
- **MIDI import/export** (Standard MIDI File) в piano roll / из него; пакет stems+MIDI для сведения в другом DAW.
- **Count-in / pre-roll** и щелчок только в cue (для записи в дорожку).
- **Группы / шины** — несколько `prodLanes` в один bus с общим insert rack. Sidechain сейчас только с kick drums.

### Session

- Больше 8 сцен, имена/цвета сцен, follow actions (запустить следующую сцену через N тактов).
- Session rec как audio takes, не только clip launcher → Arrange.

### DJ → продакшен

- **Beatgrid edit** вручную (анализ есть, правки сетки нет).
- **Memory cues / фразы** сверх 4 hotcue.
- Echo-out в Bounce как автоматизация (сейчас **только live**).
- Ableton Link / MIDI clock — играть клипы с железным секвенсором. Не HID/CDJ.

### Надёжность сессии

- **Project bundle** — zip graph + audio files (export JSON без семплов не переносится на другую машину).
- Collab `state` не шлёт `prodLanes` и automation — второй клиент не видит production console.
- Снимки History хранят весь graph в SQLite (лимит 30); большой проект раздует БД — имеет смысл сжимать / не писать каждый autosave.

### Если выкладывать не только localhost

- `REQUIRE_AUTH=true` по умолчанию в прод-профиле, смена пароля, TTL JWT короче 168 ч.
- Серверный render не выдавать за 1:1 (это уже так в коде; UI не должен обещать «offline mixdown»).
- CI на pytest + `npm run build` (сейчас workflow в основном Windows desktop installer).
- Desktop (`desktop/`): подпись NSIS, автообновления. Без подписи SmartScreen будет ругаться.

## Средний приоритет (осталось)

- ~~Mixer EQ/filter/gain/volume controlled (`value`)~~ — сделано на mixer strips
- ~~MIDI learn с деки: hotcue/loop/PFL note map 1:1 как у конкретного DDJ, не только CC Pioneer-ish~~ — Shift+click + `channel:note`; defaults Pioneer-ish DDJ-400-style, не официальный дамп
- ~~Отдельное окно/устройство для headphones без `getUserMedia` permission dance~~ — cue popup + `selectAudioOutput` / enumerate without mic
- VST/AU / third-party plugin scan (browser cannot load Serum, FabFilter, soothe2, ShaperBox)

## Не делать вид, что это баги архитектуры

- GPU Demucs без `requirements-stems.txt` и CUDA/MPS → честный HPSS
- Bounce 1:1 с live graph, не sample-identical с железом Pioneer
- Репозиторий GitHub может называться `DJ`, продукт — ForgeDeck (Settings → Rename repository)
- Split cue на одном выходе — не замена настоящей cue-паре; `setSinkId` есть не во всех браузерах
- Браузер не хост VST/AU — production console = встроенный Web Audio

Когда пункт берёшь в работу: вычеркни здесь и после мержа добавь строку в `CHANGELOG.md`.
