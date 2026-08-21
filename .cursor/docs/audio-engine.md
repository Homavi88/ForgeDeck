# Audio engine

Всё realtime-аудио: `frontend/src/audio-engine/`. Python сюда не входит.

## Граф live

```
Deck A/B ─┐
Drums ────┼─► Mixer channels ─► xfader A/B (только A/B) ─► master ChannelStrip ─► Limiter ─► dest
Synth ────┤
audio-N ──┘  (Mixer.addLane → master.input, не xfader)
                    ChannelStrip:
                    trim → [insertOrder: EQ3 / Filter / FX…] → duck ┬→ mute → vol → pan → analyser → out
                           fxSend sits immediately before the first FX device
                           Filter.output (or trim) → sendRev / sendDly → return bus
                                                                  └→ pflOut (PFL/CUE, до mute)
```

`fxSend` = 1 в нормальной работе. **Echo out** (live): delay/reverb wet вверх, `fxSend` → 0, хвост продолжает идти через mute/volume; bounce этот жест не автоматизирует.

**Return bus:** `sendRev` / `sendDly` tap the **Filter** device's output (wherever Filter sits in `insertOrder`; else trim) into shared `ReverbFx` / `DelayFx` (dry=0). Return fader → `master.input`. Bounce копирует send amounts, return levels и `insertOrder`.

EQ3 isolator **kills** (−72 dB) не затирают значение ручки (`EQ3.user` / `kills`).

Crossfader: `xfaderGains(x, curve)` — smooth = equal-power, sharp = узкий overlap, cut = оба открыты до ~7% у краёв.

PFL: `pflOut` каналов A/B → `cueBus`. Headphones: mix master analyser + cue bus (`cueMix` 0=master … 1=cue) → `MediaStreamAudioDestinationNode` (только realtime `AudioContext`, не Offline bounce). Hidden `<audio>` и опциональное **окно cue** (`window.open` blank HTML) играют **тот же stream** — не второй SPA и не второй AudioContext. `selectAudioOutput()` (Chrome) или `enumerateDevices()` **без** `getUserMedia`. Split cue: L=master, R=cue на основном `destination`. `setSinkId` копируется на hidden и popup audio.

`EffectChain` устройства сами по себе не склеены; `ChannelStrip.wireInserts(insertOrder)` ставит EQ3 / Filter / comp / dist / crush / flanger / delay / reverb в сохранённом порядке. **bypass** ставит wet=0. `fxSend` всегда сразу перед первым FX, чтобы echo-out глушил хвосты, а не EQ. Default order = прежний фиксированный.

Insert rack UI (`InsertRack`) рисует устройства **слева направо в audio order**; ←/→ и drag меняют `mixer[id].insertOrder` и пересобирают граф. Это не VST.

IR и кривые драйва: `analog.ts` (seeded, чтобы bounce был детерминированным).

## Дека и key lock

`Deck.ts`

- Vinyl (key lock off): `AudioBufferSourceNode.playbackRate = 1 + pitch/100`
- Key lock on: тот же rate (темп как у CDJ), Rubber Band `setPitch(1/rate)` — тональность стоит
- WASM: `rubberband.ts` → worklet `/worklets/rubberband-processor.js`
- Если worklet не загрузился: WSOLA grains (~70 ms, hop 17.5 ms, Hann, 4× overlap)
- `keyLockEngine`: `rubberband` | `wsola` | `vinyl`

Цикл, hotcue, beat jump, slip, loop roll, scratch platter — в том же классе. Stem rack создаёт отдельные `Deck` на тот же channel input и глушит оригинал. ISO солоит один стем.

Клипы Session/Arrange: `clipPlayback.ts` — `playbackRate = projectBpm / sourceBpm`; Rubber Band `setPitch` держит исходную тональность (как key lock) и при **Key follow** добавляет semitone delta к `musical_key`. Если WASM нет — только playbackRate. WSOLA для клипов не используется. Arrange **fade in/out** — `GainNode` перед каналом (linearRamp); bounce использует те же секунды (`fadeInBars`/`fadeOutBars` × barSec). Session loops fades не ставят.

`TimelineEngine` стартует клип на `round(startBar * 16)` 16th-step, не только на целом такте. Gating drums/synth в arrange сравнивает playhead `step/16` с интервалом клипа (дроби ок). `reset()` при Stop, чтобы клипы снова стреляли с начала.

`AutomationEngine` хранит точки `{time,value}` (time в секундах). Live: каждый 16th пишет volume/filter/EQ на **любой** канал микшера (`writeAutomationValue`). Bounce: `scheduleAutomationLanes` ставит `setValueAtTime` / `linearRampToValueAtTime` на те же AudioParam. Filter **type** (LP/HP) не AudioParam — при пересечении нуля bounce приблизительный. Arrange: мышью рисуешь кривую (`AutomationLane`).

Прогрев WASM: `AudioEngine.init()` → `warmupRubberBand`.

## Bounce 1:1

`offlineRender.ts`

1. `new Mixer(offline, destination)` + `await mixer.ready()` (bitcrush worklet)
2. `snapshotStrip` с live каналов → `applyStripState`
3. Деки: Rubber Band на OfflineAudioContext при key lock; стемы, если rack активен
4. Drums + `duckFromKick` как в live
5. Synth + timeline clips (**warped** через тот же `scheduleWarpedClip`, включая stem-клипы)
6. Return reverb/delay как в live mixer
7. Automation ramps (`scheduleAutomationLanes`) на volume / filter freq / EQ low
8. WAV через `encodeWav`

Не собирать урезанный EQ+delay «для экспорта» — это снова разъедет live и bounce.

## Прочее

| Класс | Роль |
| --- | --- |
| `Transport` | clock, metronome, ticks для drums/timeline/piano |
| `DrumMachine` | 16 падов, swing, onKick → sidechain; UI paint + velocity graph |
| `Synth` + `PianoRoll` | OSC/ADSR/filter/LFO; `loopSteps` = длина паттерна; note-off не режет ноту, стартующую на том же шаге |
| `Sampler` | slice на пады; стемы грузятся тем же prefetch |
| `ClipLauncher` | session scenes; audio слоты loop + warp; ряды = CORE + `prodLanes` (те же trackId, что Arrange) |
| `TimelineEngine` | arrange clips; fire at fractional start step; audio warp + fade 1:1 с bounce |
| `clipPlayback.ts` | shared Rubber Band / playbackRate warp + optional clip GainNode fade |
| `AutomationEngine` | filter/EQ/volume lanes; live tick + bounce ramps |
| `LiveRecorder` | MediaRecorder с master |
| `midiMap.ts` | Pioneer-ish CC + DDJ-400-style notes (`channel:note`, ch1=A / ch2=B); learn from Settings or Shift+click on the deck |

`ChannelStrip` / FX принимают `BaseAudioContext`, чтобы тот же код жил в OfflineAudioContext.
