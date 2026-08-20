# PulseForge TODO / roadmap

## Done in MVP
- [x] Monorepo: backend, frontend, workers, ai_agents, storage
- [x] Docker Compose (Postgres, Redis, API, worker, frontend)
- [x] FastAPI + SQLAlchemy models + Alembic initial migration
- [x] Upload + waveform/BPM/key/loudness analysis
- [x] 2 DJ decks + mixer + crossfader + EQ3 + filter + FX
- [x] Waveform + beatgrid canvas
- [x] Project CRUD / duplicate / JSON export / render job
- [x] Mock AI Producer with tool-calling JSON + preview/apply
- [x] Drum machine 16 pads + step sequencer
- [x] Browser synth + keyboard + Web MIDI hook
- [x] Arrangement timeline (drag / trim / split)
- [x] Backend tests + OpenAPI

## Audio engine
- [ ] Independent time-stretch / key lock (Rubber Band or SoundTouch WASM)
- [ ] Scratch / platter vinyl mode
- [ ] Quantized hot-cues to beatgrid
- [ ] Slip mode, beat jump, loop roll
- [ ] True AudioWorklet mixer (move EQ/filter off main thread)
- [ ] Sidechain ducking from kick envelope to bass/synth
- [ ] Clip launcher (Ableton session view)
- [ ] Piano roll editor (not just keyboard)
- [ ] Sample slicing UI using `analysis.onsets`
- [ ] Recording / resample from master

## Analysis & backend
- [ ] Optional librosa in default image
- [ ] Demucs/Spleeter stem worker (GPU image)
- [ ] Essentia MIR (danceability, energy, Camelot)
- [ ] Accurate loudness (ITU-R BS.1770 / pyloudnorm)
- [ ] Beatgrid tap + manual nudge
- [ ] Real mixdown of the Web Audio graph (offline render from project graph)
- [ ] Auth (JWT / OAuth) instead of demo user
- [ ] Object storage (S3) for audio
- [ ] WebSocket presence + collaborative transport

## AI
- [ ] OpenAI / Anthropic / Gemini provider adapters
- [ ] Tool-calling with schema validation (jsonschema)
- [ ] Compatible-track suggestions from library (BPM/key distance)
- [ ] Transition plans that write real automation into the engine
- [ ] Genre-conditioned melody / bassline MIDI generation

## Product
- [ ] Mapping for MIDI controllers (Pioneer, Akai, generic)
- [ ] Mobile layout
- [ ] Preset / kit browser
- [ ] Undo/redo
- [ ] Automated E2E (Playwright) for studio smoke
