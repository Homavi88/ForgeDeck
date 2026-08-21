# Audio engine

Всё realtime-аудио: `frontend/src/audio-engine/`. Python сюда не входит.

## Граф live

```
Deck A/B ─┐
Drums ────┼─► Mixer channels ─► xfader A/B (только A/B) ─► master ChannelStrip ─► Limiter ─► dest
Synth ────┤
audio-N ──┘  (Mixer.addLane → master.input, не xfader)
                    ChannelStrip:
                    trim → EQ3 → Filter ┬→ fxSend → EffectChain → duck ┬→ mute → vol → pan → analyser → out
                                        ├→ sendRev → return reverb ───┘         └→ pflOut
                                        └→ sendDly → return delay  ─┘ → master.input
                                                             └→ pflOut (PFL/CUE, до mute)
```

`fxSend` = 1 в нормальной работе. **Echo out** (live): delay/reverb wet вверх, `fxSend` → 0, хвост продолжает идти через mute/volume; bounce этот жест не автоматизирует.

**Return bus:** `sendRev` / `sendDly` с каждого канала (post-EQ, pre-insert FX) в общие `ReverbFx` / `DelayFx` (dry=0). Return fader → `master.input`. Bounce копирует send amounts и return levels.

EQ3 isolator **kills** (−72 dB) не затирают значение ручки (`EQ3.user` / `kills`).

Crossfader: `xfaderGains(x, curve)` — smooth = equal-power, sharp = узкий overlap, cut = оба открыты до ~7% у краёв.

PFL: `pflOut` каналов A/B → `cueBus`. Headphones: mix master analyser + cue bus (`cueMix` 0=master … 1=cue) → `MediaStreamAudioDestinationNode` (только realtime `AudioContext`, не Offline bounce). Split cue: L=master, R=cue на основном `destination`.

`EffectChain` (порядок фиксирован; **bypass** ставит wet=0):

compressor → analog distortion + cabinet IR → bitcrush → flanger → delay → reverb (plate/spring + tape IR)

Insert rack UI (`InsertRack`) крутит те же устройства **на выбранном канале** плюс EQ3/Filter стрипа. Это не VST.

IR и кривые драйва: `analog.ts` (seeded, чтобы bounce был детерминированным).

## Дека и key lock

`Deck.ts`

- Vinyl (key lock off): `AudioBufferSourceNode.playbackRate = 1 + pitch/100`
- Key lock on: тот же rate (темп как у CDJ), Rubber Band `setPitch(1/rate)` — тональность стоит
- WASM: `rubberband.ts` → worklet `/worklets/rubberband-processor.js`
- Если worklet не загрузился: WSOLA grains (~70 ms, hop 17.5 ms, Hann, 4× overlap)
- `keyLockEngine`: `rubberband` | `wsola` | `vinyl`

Цикл, hotcue, beat jump, slip, loop roll, scratch platter — в том же классе. Stem rack создаёт отдельные `Deck` на тот же channel input и глушит оригинал. ISO солоит один стем.

Клипы Session/Arrange: `clipPlayback.ts` — `playbackRate = projectBpm / sourceBpm`; Rubber Band `setPitch` держит исходную тональность (как key lock) и при **Key follow** добавляет semitone delta к `musical_key`. Если WASM нет — только playbackRate. WSOLA для клипов не используется.

Прогрев WASM: `AudioEngine.init()` → `warmupRubberBand`.

## Bounce 1:1

`offlineRender.ts`

1. `new Mixer(offline, destination)` + `await mixer.ready()` (bitcrush worklet)
2. `snapshotStrip` с live каналов → `applyStripState`
3. Деки: Rubber Band на OfflineAudioContext при key lock; стемы, если rack активен
4. Drums + `duckFromKick` как в live
5. Synth + timeline clips (**warped** через тот же `scheduleWarpedClip`, включая stem-клипы)
6. Return reverb/delay как в live mixer
7. WAV через `encodeWav`

Не собирать урезанный EQ+delay «для экспорта» — это снова разъедет live и bounce.

## Прочее

| Класс | Роль |
| --- | --- |
| `Transport` | clock, metronome, ticks для drums/timeline/piano |
| `DrumMachine` | 16 падов, swing, onKick → sidechain; UI paint + velocity graph |
| `Synth` + `PianoRoll` | OSC/ADSR/filter/LFO; `loopSteps` = длина паттерна; note-off не режет ноту, стартующую на том же шаге |
| `Sampler` | slice на пады; стемы грузятся тем же prefetch |
| `ClipLauncher` | session scenes; audio слоты loop + warp |
| `TimelineEngine` | arrange clips; audio warp 1:1 с bounce |
| `clipPlayback.ts` | shared Rubber Band / playbackRate warp |
| `AutomationEngine` | filter/EQ/volume lanes |
| `LiveRecorder` | MediaRecorder с master |
| `midiMap.ts` | Pioneer-ish CC map по умолчанию, learn, localStorage |

`ChannelStrip` / FX принимают `BaseAudioContext`, чтобы тот же код жил в OfflineAudioContext.
