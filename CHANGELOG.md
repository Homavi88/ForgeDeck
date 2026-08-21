# Changelog

Формат: что попало в `main`. Детали PR — на GitHub.

## Unreleased

- Windows launcher: `bat/setup.bat` / `start.bat` no longer rely only on the double-clicked cmd PATH for Node.js. They find standard installs plus nvm/fnm/Volta/Scoop/Chocolatey, install Node LTS from the `winget` source (then Chocolatey), then download and verify the signed official MSI as the automatic fallback — avoiding a broken `msstore` certificate.
- Insert rack order is the real ChannelStrip graph: drag or ←/→ on Console inserts (EQ / filter / FX). Echo-out still starves FX via `fxSend` placed before the first FX device. Aux sends follow the Filter device. Bounce uses the same order. Not VST/AU.
- MIDI learn 1:1 from the deck: Shift+click Play / Cue / PFL / hotcue / loop / key lock (channel+note, Pioneer-ish DDJ-400-style defaults on ch1=A / ch2=B — not an official dump). Settings still maps CC and now lists notes.
- Headphones cue window: Open cue window plays the same headphone MediaStream (not a second AudioContext). Output picker uses `selectAudioOutput` when the browser has it; listing devices no longer calls `getUserMedia`.
- Arrange automation: draw volume / filter / EQ-low on the timeline (snap + zoom). Same points drive live mixer writes and bounce ramps. Extra `prodLanes` have their own targets. Filter LP/HP type is not an AudioParam — a zero-cross on bounce is approximate.
- Session view uses the same tracks as Arrange (`prodLanes`): extra audio rows, scene launch across every lane, Session rec / Capture write those clips onto the timeline. Console sits under the launcher. Not a second independent track list.
- Arrange clips: snap (bar / beat / 8th), timeline zoom, duplicate (Ctrl/Cmd+D), copy/paste, drag onto other tracks (Alt = copy), fade-in/out as a real GainNode envelope on live playback and bounce. Fractional clip starts fire on the transport (beat-snapped clips actually play).
- Production console on Arrange: extra audio tracks, per-channel insert rack (EQ/filter/comp/drive/crush/flange/delay/reverb with bypass), clip waveforms + trim handles. Not VST/AU — built-in Web Audio devices. DJ mixer in DJ mode is unchanged.
- Electronic style packs: original ForgeDeck genre templates (house, deep house, techno, trance, DnB, dubstep, UKG, synthwave, ambient, electro) — BPM/key, drums, synth, FX, piano-roll notes. Settings cards plus drums-only / synth-only dropdowns. Not licensed Serum/Vital/Ableton banks; not fetched at runtime.
- TopBar студии в две строки: режимы не обрезаются, транспорт/Save/Rec/Bounce сверху, панели и язык снизу
- Audio clips on Session / Arrange warp to project BPM (Rubber Band, playbackRate fallback); optional Key follow to project `musical_key`. Bounce schedules the same warp.
- Session rec / Capture to arrange: launched scenes write drums/synth/audio clips onto the Arrange timeline, quantized to bars
- Stem rack: ISO solo plus drag a stem onto sampler/drum pads or Arrange as its own clip (offline Demucs/HPSS, not realtime)
- Mixer send/return: per-channel Send rev / Send dly into a shared reverb+delay bus; bounce includes the return
- Crate analysis: `energy` 1–10, `mix_in` / `mix_out` phrase times; library cards show them; next crate track highlighted by Camelot + energy
- DJ mix tools: instant doubles (D), crossfader curve (smooth/sharp/cut), EQ isolator kills, auto gain match, beat offset + quantize sync, live echo-out
- Piano roll как в FL Studio: карандаш с длиной, select/marquee, штамп аккордов, подсветка гаммы, snap, velocity, quantize/humanize
- Piano roll: Arp (up/down/up-down/random, 2 oct) и Strum ↑/↓ по выделенным нотам; банк MIDI-паттернов и ghost-ноты (Alt-клик копирует); Undo для +/- паттерна
- Тональность проекта в TopBar (`musical_key`) — та же, что для AI bass/melody/chords и scale highlight
- Drums Channel Rack: paint по сетке, graph editor velocity, fill 1/4·1/8·all·offbeat, сдвиг паттерна, humanize
- Bounce synth-петли использует длину паттерна (16/32/64), а не всегда 16 шагов
- Autosave больше не падает с 500 `MultipleResultsFound`: паттерн `Main` / пресет `Current` upsert, дубли в SQLite чистятся при старте
- Кнопка **Выключить** в шапке (домашняя и студия): закрывает окна API/UI/launcher и останавливает процессы на :8000 / :5173 (`POST /api/shutdown`, только localhost)
- UI на русском и английском: переключатель RU/EN в шапке (Shell) и в студии (TopBar); язык в `localStorage` (`fd_locale`), иначе `navigator.language` `ru*` → ru, иначе en. Кнопка **Выключить**, confirm и goodbye-экран тоже из словаря.
- macOS `setup.command`: ищет Node в Homebrew/nvm/fnm/volta; если нет — ставит через `brew install node` (двойной клик из Finder не видит `~/.zshrc`)
- Внутренние docs перенесены в `.cursor/docs/` (не на GitHub-лендинге); агент читает их по `docs-sync` правилу
- DJ: CDJ-клавиатура (focus A/B, cue, hotcue 1–4, loop, beat jump, crate load, sync, PFL, tap tempo)
- Library: поиск, сортировка BPM/Camelot/recent, подсветка совместимых с Deck A, drag-and-drop на деку
- PFL/headphones: pre-fader cue bus, cue mix, split cue L/R, setSinkId на второй выход
- Тосты: autosave, анализ, stems, bounce
- Скрытие AI / library / fullscreen дек; zoom и key lock помнятся на трек; pitch ±8/±16/±100
- Недавние проекты на `/`; MIDI-карта Pioneer-ish по умолчанию
- Документация для разработки: `.cursor/docs/`, `CHANGELOG.md`, `CONTRIBUTING.md`
- Правило агента: всегда обновлять docs вместе с кодом (`.cursor/rules/docs-sync.mdc`, `AGENTS.md`)

## 0.1.0 (2026-08-20)

### GitHub / бренд

- Продукт переименован в **ForgeDeck** (было PulseForge): UI, demo login `producer@forgedeck.local`, Docker/SQLite/Celery/S3 prefix, пакет `forgedeck-web` (#3)
- Шапка README на главной репозитория (#4)

### Звук

- Key lock: Rubber Band WASM (CDJ master tempo); WSOLA только если WASM не загрузился (#2)
- Bounce 1:1: тот же ChannelStrip, analog distortion + cabinet IR, plate/spring/tape convolution, limiter, sidechain (#2)
- GPU Demucs: cuda → mps → cpu, иначе HPSS; engine пишется честно (#2)

### Студия (накоплено в #1–#2)

- 2 деки, mixer, drums, synth, session, arrange, sampler, AI Producer
- Crate/queue auto-advance, waveform zoom, autosave, Rec HUD, Space to play
- Stem rack, mic/line-in, collab presence/chat/locks
- Share `/share/:token`, квота 2 GB, upload 250 MB, owner checks
- Windows `bat/` и macOS `mac/` лаунчеры
- JWT, demo user при `REQUIRE_AUTH=false`
