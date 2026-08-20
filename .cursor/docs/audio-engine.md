# Audio engine

Всё realtime-аудио: `frontend/src/audio-engine/`. Python сюда не входит.

## Граф live

```
Deck A/B ─┐
Drums ────┼─► Mixer channels ─► xfader A/B ─► master ChannelStrip ─► Limiter ─► dest
Synth ────┘         │
                    ChannelStrip:
                    trim → EQ3 → Filter → EffectChain → duck ┬→ mute → vol → pan → analyser → out
                                                             └→ pflOut (PFL/CUE, до mute)
```

PFL: `pflOut` каналов A/B → `cueBus`. Headphones: mix master analyser + cue bus (`cueMix` 0=master … 1=cue) → `MediaStreamAudioDestinationNode` (только realtime `AudioContext`, не Offline bounce). Split cue: L=master, R=cue на основном `destination`.

`EffectChain` (порядок фиксирован):

compressor → analog distortion + cabinet IR → bitcrush → flanger → delay → reverb (plate/spring + tape IR)

IR и кривые драйва: `analog.ts` (seeded, чтобы bounce был детерминированным).

## Дека и key lock

`Deck.ts`

- Vinyl (key lock off): `AudioBufferSourceNode.playbackRate = 1 + pitch/100`
- Key lock on: тот же rate (темп как у CDJ), Rubber Band `setPitch(1/rate)` — тональность стоит
- WASM: `rubberband.ts` → worklet `/worklets/rubberband-processor.js`
- Если worklet не загрузился: WSOLA grains (~70 ms, hop 17.5 ms, Hann, 4× overlap)
- `keyLockEngine`: `rubberband` | `wsola` | `vinyl`

Цикл, hotcue, beat jump, slip, loop roll, scratch platter — в том же классе. Stem rack создаёт отдельные `Deck` на тот же channel input и глушит оригинал.

Прогрев WASM: `AudioEngine.init()` → `warmupRubberBand`.

## Bounce 1:1

`offlineRender.ts`

1. `new Mixer(offline, destination)` + `await mixer.ready()` (bitcrush worklet)
2. `snapshotStrip` с live каналов → `applyStripState`
3. Деки: Rubber Band на OfflineAudioContext при key lock; стемы, если rack активен
4. Drums + `duckFromKick` как в live
5. Synth + timeline clips
6. WAV через `encodeWav`

Не собирать урезанный EQ+delay «для экспорта» — это снова разъедет live и bounce.

## Прочее

| Класс | Роль |
| --- | --- |
| `Transport` | clock, metronome, ticks для drums/timeline/piano |
| `DrumMachine` | 16 падов, swing, onKick → sidechain |
| `Synth` + `PianoRoll` | OSC/ADSR/filter/LFO |
| `Sampler` | slice на пады |
| `ClipLauncher` | session scenes |
| `TimelineEngine` | arrange clips |
| `AutomationEngine` | filter/EQ/volume lanes |
| `LiveRecorder` | MediaRecorder с master |
| `midiMap.ts` | Pioneer-ish CC map по умолчанию, learn, localStorage |

`ChannelStrip` / FX принимают `BaseAudioContext`, чтобы тот же код жил в OfflineAudioContext.
