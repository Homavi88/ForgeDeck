# ForgeDeck TODO / roadmap

Живой чеклист **сделанного**. Как устроен код: [`docs/README.md`](docs/README.md). Что ещё удобно сделать: [`docs/roadmap.md`](docs/roadmap.md). История релизов: [`CHANGELOG.md`](CHANGELOG.md).

## Done
- [x] Monorepo, Docker Compose, FastAPI, Alembic, OpenAPI
- [x] Upload + BPM/key/Camelot/waveform/beatgrid analysis
- [x] MP3/M4A analysis via miniaudio (no ffmpeg required)
- [x] First project auto-loads demo loop onto Deck A / Library
- [x] 2 DJ decks + mixer + crossfader + EQ3 + filter + FX + VU
- [x] Key lock (Rubber Band WASM, CDJ master tempo; WSOLA fallback)
- [x] Mixer pan / mute / solo / sidechain ducking from kick
- [x] Drum machine + save pattern, sampler slice-to-pads, kit save/load
- [x] Synth + piano roll + Web MIDI (keys, pads, CC map + learn UI)
- [x] Session clip launcher (8 scenes)
- [x] Arrangement timeline plays drums/synth/audio clips + automation lanes
- [x] Project graph hydrate on save (patterns, mixer, synth)
- [x] AI Producer: cues, transition automation, drums, synth, arrangement, bassline/melody/chords, compatible tracks, HPSS stems
- [x] OpenAI-compatible provider (falls back to mock)
- [x] Undo/redo, Ctrl+S save
- [x] Stem split: GPU Demucs (CUDA/MPS) when torch+demucs are installed, else CPU Demucs CLI, else HPSS
- [x] JWT register/login/me (demo user when REQUIRE_AUTH=false)
- [x] Optional S3 object store (local disk fallback)
- [x] FX / MIDI / drum-kit preset APIs + browsers in Settings and Mixer
- [x] Vinyl platter scratch + loop roll
- [x] Offline bounce 1:1 of the live mixer graph (EQ/filter/comp/analog dist+cab IR/bitcrush/flanger/delay/plate+tape convolution/sidechain/limiter)
- [x] Collaborative WebSocket: BPM, play, mixer, decks, drums, notes, clips, mode
- [x] Backend tests + Playwright smoke
- [x] Windows `bat/` and macOS `mac/` launchers
- [x] Autoplay demo on first click, crate/queue auto-advance
- [x] Waveform overview + zoom/pan
- [x] Project autosave + Rec HUD (time/peak/size)
- [x] Tighter key-lock grains (Hann, 4× overlap)
- [x] Bounce delay/reverb, stem rack, mic into master/Rec
- [x] Collab presence, room chat, edit locks
- [x] Generated SECRET_KEY, 250 MB uploads, 2 GB quota
- [x] Public share page `/share/:token`, X-Forwarded-Proto
- [x] Project/audio/WS owner checks, Anthropic provider, global FX delete guard

## Honest leftovers (named heavy stacks, not missing product paths)
- [x] Rubber Band WASM key lock — GPL worklet; WSOLA only if WASM fails to load
- [x] GPU Demucs — requires extra `requirements-stems.txt` + CUDA/MPS; else CPU Demucs or HPSS
- [x] Bounce 1:1 — same ChannelStrip + analog/convolution plugins as the live desk (not bit-identical sample-for-sample vs a hardware CDJ)
