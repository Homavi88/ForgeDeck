# Студия (продукт)

Кратко, что видит пользователь. Для UX-правок этого достаточно; звуковой граф — [audio-engine.md](audio-engine.md).

## Режимы (TopBar)

**DJ** — две деки, vinyl platter, waveform overview+zoom, cue/hotcues, loop in/out, loop roll, Rubber Band key lock, beat jump, quantize, slip, sync, EQ3, filter, FX, pan/mute/solo, sidechain, stem rack, crate/queue auto-advance, drop файлов в library.

**Session** — clip launcher, 8 сцен (drums / synth / audio).

**Arrange** — клипы на таймлайне, automation lanes (filter, EQ, volume).

**Drums** — 16 падов, 16/32/64 шага, swing, save pattern/kit, edit lock в коллабе.

**Synth** — OSC, ADSR, filter, LFO, piano roll, Web MIDI + learn.

**Sampler** — trim/reverse/loop/pitch, slice to pads, split stems.

Справа **AI Producer** + вкладка Room (presence, чат, локи).

## Экспорт и шаринг

- **Bounce** — offline WAV через полный mixer graph, upload в проект, скачивание
- **Rec** — live с master (+ mic, если включён); HUD: время, peak, размер
- **Share** — `POST /api/projects/{id}/share` → `/share/:token` (нужен bounce или rec)

## Горячие клавиши

| Клавиша | Действие |
| --- | --- |
| Space | Play / pause |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |

Остальное — клики. Идеи (поиск в library, PFL, hotcue с клавиш): [roadmap.md](roadmap.md).

## Demo

Первый проект получает `ForgeDeck Demo Loop.wav` на Deck A. Первый pointerdown резюмит AudioContext и играет демо.
