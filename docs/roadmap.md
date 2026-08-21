# Roadmap (ещё не в коде)

Чеклист уже сделанного продукта: [`TODO.md`](../TODO.md). Здесь — удобства, которые обсуждались и **намеренно не начаты**, чтобы не потерять приоритет.

DJ must-have с клавиатурой, library search, drag на деку, PFL, тостами и hide AI/library — в коде (см. [studio.md](studio.md)). История проекта (restore points) — в коде. Mix-to-file / timeline / session / DJ→prod leftovers from the production list — in code except the honest skips below.

## Продакшен (писать и отдавать трек)

Это не «добавить VST». Браузер не загрузит Serum / FabFilter. Ниже — то, что **можно** довести в Web Audio, чтобы трек доводили до релиза, а не только скетчили.

### Довести микс до файла

- ~~**Freeze / flatten** — drums, synth или audio+inserts в новый WAV-клип на той же дорожке.~~ Arrange toolbar + Console: Freeze / Unfreeze / Flatten. Freeze = insert rack (`ChannelStrip.duck`), не мастер и не send-returns. Unfreeze читает `graph.frozenLanes`.
- ~~**Bounce куска** — цикл / между локаторами.~~ Arrange **from / bars**; пусто = весь микс (как раньше, потолок 8 мин). Loop range uses that window.
- ~~**24-bit / 48 kHz** Bounce~~ PCM. Rec live остаётся 16-bit **с TPDF dither**.
- ~~**Стемы / per-track export**~~ — выбранная полоска или **Export all** (insert rack). ISO стемов Demucs — не то же самое.
- ~~**Rec в дорожку**~~ Rec пишет master + скачивание; клип падает на `selectedMixId`.
- ~~**Список Bounce/Rec**~~ TopBar **Renders** (`GET /renders`, download with Bearer).
- ~~**LUFS / true peak** на Bounce~~ gated BS.1770-ish at 48 kHz; optional **−14 LUFS / −1 dBTP** (LUFS toggle).
- ~~**MP3/FLAC Bounce**~~ WAV stays 24-bit PCM in the browser; server `render_convert` writes FLAC (soundfile) or MP3 (ffmpeg/libmp3lame if installed). Share still prefers the last done job file.

### Таймлайн как в DAW

- ~~**Локаторы / loop range**~~ Bounce from/bars + Arrange **Loop range** on Transport.
- ~~**Tempo map**~~ points `{bar, bpm}` (`Tempo @ from` writes current BPM at Bounce-from). Meter changes are not in.
- **Warp-маркеры** на аудио (транзиенты) — clip **offset** is a stand-in, not a marker list.
- ~~**Clip gain / reverse / transpose**~~ + **crossfade** onto the previous clip on that track.
- ~~**Automation стрипа**~~ volume / filter / EQ-low / **pan / send rev / send dly**. Wet/bypass per insert still not drawn. Filter LP↔HP on bounce is still approximate.
- **Несколько инструментов** — второй synth, второй drum rack, sampler как Arrange-инструмент. Сейчас один synth + один 16-pad kit на весь проект.
- ~~**MIDI import/export**~~ Standard MIDI File on the piano roll.
- ~~**Count-in / pre-roll**~~ TopBar bars (0–8) + metronome; not cue-only click.
- ~~**Группы / шины**~~ extra `prodLanes` can route into another extra lane (`busId`). A/B stay on the xfader.

### Session

- ~~Больше 8 сцен, имена, follow actions~~ 12 scenes, stock names, follow-bars → next scene.
- ~~Session rec как audio takes~~ master take on the selected Arrange lane **plus** launcher clips → Arrange.

### DJ → продакшен

- ~~**Beatgrid edit**~~ ±10 ms nudge (analysis overlay + warp; file unchanged).
- ~~**Hotcues 1–8**~~ (was 4).
- ~~Echo-out в Bounce~~ last 2 bars starve inserts / raise delay+reverb.
- Ableton Link — **не делать вид**. MIDI clock on the first Web MIDI output is JS timing, not sample-accurate Link.

### Надёжность сессии

- ~~**Project bundle**~~ `GET /projects/{id}/bundle` zip (`project.json`, `graph.json`, `audio/`).
- ~~Collab `prodLanes` / automation / `frozenLanes`~~ in `state`.
- ~~Снимки History сжимать~~ gzip+base64 when the graph is ≥2 KB (`snapshot_codec`).

### Если выкладывать не только localhost

- ~~`APP_ENV=production` → auth on, JWT ≤24 h, смена пароля~~ Settings form; `POST /api/auth/password`.
- Серверный render не выдавать за 1:1 (это уже так в коде; UI не должен обещать «offline mixdown»).
- ~~CI на pytest + `npm run build`~~ `.github/workflows/ci.yml`. Windows installer workflow is separate.
- Desktop (`desktop/`): подпись NSIS, автообновления. Без подписи SmartScreen будет ругаться. **Skip until a cert exists.**

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
- Ableton Link в браузере нет; MIDI clock ≠ Link
- NSIS без сертификата будет ругаться — это не баг лаунчера

Когда пункт берёшь в работу: вычеркни здесь и после мержа добавь строку в `CHANGELOG.md`.
