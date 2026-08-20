# Changelog

Формат: что попало в `main`. Детали PR — на GitHub.

## Unreleased

- UI на русском и английском: переключатель RU/EN в шапке (Shell) и в студии (TopBar); язык в `localStorage` (`fd_locale`), иначе `navigator.language` `ru*` → ru, иначе en
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
