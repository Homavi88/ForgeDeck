# PulseForge TODO / roadmap

## Done
- [x] Monorepo, Docker Compose, FastAPI, Alembic, OpenAPI
- [x] Upload + BPM/key/Camelot/waveform/beatgrid analysis
- [x] 2 DJ decks + mixer + crossfader + EQ3 + filter + FX + VU
- [x] Key lock (granular WSOLA), loop in/out, beat jump, quantize, slip flag
- [x] Mixer pan / mute / solo / sidechain ducking from kick
- [x] Drum machine + save pattern, sampler slice-to-pads, kit save/load
- [x] Synth + piano roll + Web MIDI (keys, pads, CC map + learn UI)
- [x] Session clip launcher (8 scenes)
- [x] Arrangement timeline plays drums/synth/audio clips + automation lanes
- [x] Project graph hydrate on save (patterns, mixer, synth)
- [x] AI Producer: cues, transition automation, drums, synth, arrangement, bassline/melody/chords, compatible tracks, HPSS stems
- [x] OpenAI-compatible provider (falls back to mock)
- [x] Undo/redo, Ctrl+S save
- [x] Stem split: Demucs CLI if installed, otherwise HPSS
- [x] JWT register/login/me (demo user when REQUIRE_AUTH=false)
- [x] Optional S3 object store (local disk fallback)
- [x] FX / MIDI / drum-kit preset APIs + browsers in Settings and Mixer
- [x] Vinyl platter scratch + loop roll
- [x] OfflineAudioContext mixdown + upload render
- [x] Collaborative WebSocket transport (BPM / crossfader)
- [x] Backend tests + Playwright smoke

## Honest leftovers (named heavy stacks, not missing product paths)
- [ ] Rubber Band / SoundTouch WASM (studio-grade timestretch) — WSOLA is the working substitute
- [ ] GPU Demucs worker — CPU Demucs CLI or HPSS already run
- [ ] 1:1 plugin graph offline bounce — deck mixdown is the working substitute
