/** Bounce / freeze: same ChannelStrip / analog+convolution FX graph as the live mixer. */
import { getEngine } from "./AudioEngine";
import { Mixer } from "./Mixer";
import { PAD_IDS } from "./DrumMachine";
import { midiToFreq } from "./demo";
import { applyKeyLock, createKeyLockNode } from "./rubberband";
import { applyStripState, snapshotStrip } from "./stripState";
import { scheduleWarpedClip } from "./clipPlayback";
import { scheduleAutomationLanes } from "./applyAutomation";
import { encodeWav, resampleBuffer, type WavBitDepth } from "./wav";
import { mixerIdForTrack } from "../lib/mix";
import { laneIsFrozen } from "../lib/freeze";
import { measureLoudness, normalizeLoudness } from "../lib/loudness";
import { MAX_RENDER_SEC, laneRenderSpan, mixRenderSpan, normalizeSpan, type RenderSpan } from "../lib/renderSpan";
import type { MidiNote, SynthParams, TimelineClip } from "../types";
import { useStudio } from "../store/useStudio";

export type { WavBitDepth } from "./wav";
export { encodeWav } from "./wav";

export type OfflineRenderOpts = {
  /** Mixer channel to freeze (inserts only, no master/returns). */
  soloLane?: string | null;
  startBar?: number;
  lengthBars?: number;
  bitDepth?: WavBitDepth;
  /** Offline context rate; default 48000. */
  sampleRate?: number;
  /** Last N bars: starve insert and raise delay/reverb (echo-out in the bounce). */
  echoOutLastBars?: number;
  /** Apply after render, before encode. */
  normalizeLufs?: number | null;
};

export async function renderOfflineWav(opts: OfflineRenderOpts = {}): Promise<Blob> {
  const buffer = await renderOfflineBuffer(opts);
  if (opts.normalizeLufs != null) normalizeLoudness(buffer, opts.normalizeLufs);
  return encodeWav(buffer, opts.bitDepth ?? 24, (opts.bitDepth ?? 24) === 16);
}

export async function renderLoudness(opts: OfflineRenderOpts = {}) {
  const buffer = await renderOfflineBuffer(opts);
  if (opts.normalizeLufs != null) return { buffer, ...normalizeLoudness(buffer, opts.normalizeLufs) };
  return { buffer, ...measureLoudness(buffer) };
}

export async function renderOfflineBuffer(opts: OfflineRenderOpts = {}): Promise<AudioBuffer> {
  const eng = getEngine();
  await eng.init();
  const s = useStudio.getState();
  const targetSr = opts.sampleRate && opts.sampleRate >= 44100 ? opts.sampleRate : 48000;
  const bpm = s.bpm || 120;
  const barSec = (60 / bpm) * 4;
  const stepSec = barSec / 16;
  const solo = opts.soloLane || null;
  const span = resolveSpan(opts, s, eng, solo);
  const frozen = (mixId: string) => !solo && laneIsFrozen(mixId, s.frozenLanes, s.clips);

  const startSec = span.startBar * barSec;
  const windowSec = Math.min(MAX_RENDER_SEC, Math.max(0.25, span.lengthBars * barSec));
  const length = Math.max(1, Math.floor(targetSr * windowSec));
  const offline = new OfflineAudioContext(2, length, targetSr);
  const mixer = new Mixer(offline, offline.destination);
  for (const id of Object.keys(s.mixer)) {
    if (!mixer.channels[id]) mixer.addLane(id);
  }
  await mixer.ready();

  for (const id of Object.keys(s.mixer)) {
    const live = eng.mixer.channels[id];
    const snap = live ? snapshotStrip(live) : s.mixer[id];
    applyStripState(mixer.channels[id], { ...snap, bypass: s.mixer[id]?.bypass });
  }
  if (solo) {
    isolateLane(mixer, solo, offline.destination);
  } else {
    applyStripState(mixer.master, snapshotStrip(eng.mixer.master));
    mixer.setXfaderCurve(eng.mixer.xfaderCurve);
    mixer.setCrossfader(eng.mixer.crossfader);
    mixer.sidechain = eng.mixer.sidechain;
    mixer.setReturnLevel("reverb", eng.mixer.returnRevLevel.gain.value);
    mixer.setReturnLevel("delay", eng.mixer.returnDlyLevel.gain.value);
    mixer.applySolo();
    scheduleAutomationLanes(mixer, s.automation, startSec);
  }

  const transplant = (buf: AudioBuffer): AudioBuffer => resampleBuffer(buf, offline, targetSr);

  const feed = async (
    buf: AudioBuffer | null,
    dest: AudioNode,
    rate: number,
    keyLock: boolean,
    timelineWhen = 0,
  ): Promise<void> => {
    if (!buf) return;
    const local = timelineWhen - startSec;
    if (local >= windowSec) return;
    const src = offline.createBufferSource();
    src.buffer = transplant(buf);
    const offset = local < 0 ? Math.min(Math.max(0, -local), Math.max(0, buf.duration - 0.01)) : 0;
    const when = Math.max(0, local);
    if (keyLock) {
      const rb = await createKeyLockNode(offline);
      if (rb) {
        src.playbackRate.value = rate;
        src.connect(rb);
        rb.connect(dest);
        applyKeyLock(rb, rate);
        src.start(when, offset);
        return;
      }
    }
    src.playbackRate.value = rate;
    src.connect(dest);
    src.start(when, offset);
  };

  const want = (mixId: string) => !solo || solo === mixId;

  for (const side of ["A", "B"] as const) {
    if (!want(side) || frozen(side)) continue;
    const dest = mixer.channels[side].input;
    const master = eng.decks[side];
    if (eng.stemsActive[side]) {
      for (const [name, d] of Object.entries(eng.stemDecks[side])) {
        if (s.stemMute[name]) continue;
        await feed(d.buffer, dest, master.rate, master.keyLock, 0);
      }
    } else {
      await feed(master.buffer, dest, master.rate, master.keyLock, 0);
    }
  }

  const hasDrums = PAD_IDS.some((id) => (s.drumSteps[id] || []).some((v) => v > 0));
  if (hasDrums && want("drums") && !frozen("drums")) {
    const lengthSteps = Math.max(1, s.drumLength || 16);
    const totalSteps = Math.ceil((startSec + windowSec) / stepSec) + 2;
    for (let step = 0; step < totalSteps; step++) {
      const idx = step % lengthSteps;
      const swing = idx % 2 === 1 ? (s.drumSwing || 0) * stepSec : 0;
      const when = step * stepSec + swing;
      const local = when - startSec;
      if (local < -0.05 || local >= windowSec) continue;
      const bar = step / 16;
      if (s.mode === "arrange" || solo === "drums") {
        const inClip = s.clips.some(
          (c) => c.trackId === "drums" && !c.frozen && c.kind !== "audio" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
        );
        if (s.clips.some((c) => c.trackId === "drums" && !c.frozen && c.kind !== "audio") && !inClip) continue;
      }
      for (const id of PAD_IDS) {
        const vel = s.drumSteps[id]?.[idx] ?? 0;
        const pad = eng.drums.pads[id];
        if (vel <= 0 || !pad) continue;
        const src = offline.createBufferSource();
        src.buffer = transplant(pad);
        const g = offline.createGain();
        g.gain.value = vel;
        src.connect(g).connect(mixer.channels.drums.input);
        src.start(Math.max(0, local));
        if (!solo && (id === "kick" || id === "kick2")) mixer.duckFromKick(Math.max(0, local));
      }
    }
  }

  if (want("synth") && !frozen("synth")) {
    scheduleSynth(
      offline,
      mixer.channels.synth.input,
      s.notes,
      s.synth,
      s.clips,
      s.mode,
      stepSec,
      startSec,
      windowSec,
      Math.max(16, s.drumLength || 16),
    );
  }

  await scheduleTimelineAudio(
    offline,
    mixer,
    s.clips.filter((c) => {
      if (c.kind !== "audio" && !c.audioFileId) return false;
      if (!solo) return true;
      return mixerIdForTrack(c.trackId) === solo;
    }),
    barSec,
    s.bpm,
    s.musicalKey,
    startSec,
    windowSec,
    async (id, stem) => {
      const key = eng.bufferKey(id, stem);
      let live = eng.buffers.get(key) || (!stem ? eng.buffers.get(id) : undefined);
      if (!live) {
        try {
          live = await eng.prefetch(id, stem);
        } catch {
          return null;
        }
      }
      return live ? transplant(live) : null;
    },
  );

  if (!solo && opts.echoOutLastBars && opts.echoOutLastBars > 0) {
    const when = Math.max(0, windowSec - opts.echoOutLastBars * barSec);
    for (const id of ["A", "B"] as const) {
      mixer.channels[id]?.scheduleEchoOut(when);
    }
  }
  if (!solo) {
    for (const [id, st] of Object.entries(s.mixer)) {
      if (st?.busId) mixer.routeLane(id, st.busId);
    }
  }

  return offline.startRendering();
}

function deckDurationSec(eng: ReturnType<typeof getEngine>, side: "A" | "B"): number {
  const deck = eng.decks[side];
  if (eng.stemsActive[side]) {
    let max = 0;
    for (const d of Object.values(eng.stemDecks[side])) {
      if (d.buffer) max = Math.max(max, d.buffer.duration / Math.max(0.05, d.rate || deck.rate || 1));
    }
    return max;
  }
  if (!deck.buffer) return 0;
  return deck.buffer.duration / Math.max(0.05, deck.rate || 1);
}

function resolveSpan(
  opts: OfflineRenderOpts,
  s: ReturnType<typeof useStudio.getState>,
  eng: ReturnType<typeof getEngine>,
  solo: string | null,
): RenderSpan {
  const bpm = s.bpm || 120;
  const deckOpts = {
    deckDurationSec: solo === "A" || solo === "B" ? deckDurationSec(eng, solo) : undefined,
    bpm,
  };
  if (solo && opts.startBar == null && opts.lengthBars == null) {
    return laneRenderSpan(solo, s.clips, s.notes, s.drumSteps, deckOpts);
  }
  const full = mixRenderSpan(s.clips, s.notes, s.drumSteps, s.automation, {
    deckDurationsSec: [deckDurationSec(eng, "A"), deckDurationSec(eng, "B")],
    bpm,
  });
  if (opts.startBar != null || opts.lengthBars != null) {
    const startBar = opts.startBar || 0;
    if (opts.lengthBars != null) return normalizeSpan({ startBar, lengthBars: opts.lengthBars });
    return normalizeSpan({ startBar, lengthBars: Math.max(0.125, full.lengthBars - startBar) });
  }
  return full;
}

function isolateLane(mixer: Mixer, mixId: string, dest: AudioNode): void {
  const disconnect = (node: AudioNode) => {
    try {
      node.disconnect();
    } catch {
      /* already disconnected */
    }
  };
  for (const ch of Object.values(mixer.channels)) disconnect(ch.output);
  disconnect(mixer.xfaderA);
  disconnect(mixer.xfaderB);
  disconnect(mixer.returnRevLevel);
  disconnect(mixer.returnDlyLevel);
  disconnect(mixer.master.output);
  const ch = mixer.channels[mixId];
  if (ch) ch.duck.connect(dest);
}

function scheduleSynth(
  offline: OfflineAudioContext,
  dest: AudioNode,
  notes: MidiNote[],
  params: SynthParams,
  clips: TimelineClip[],
  mode: string,
  stepSec: number,
  startSec: number,
  windowSec: number,
  loop: number,
): void {
  if (!notes.length) return;
  const endSec = startSec + windowSec;
  const totalSteps = Math.ceil(endSec / stepSec) + loop;
  for (let cycle = 0; cycle * loop < totalSteps; cycle++) {
    const bar = (cycle * loop) / 16;
    if (mode === "arrange") {
      const inClip = clips.some(
        (c) => c.trackId === "synth" && !c.frozen && c.kind !== "audio" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
      );
      if (clips.some((c) => c.trackId === "synth" && !c.frozen && c.kind !== "audio") && !inClip) continue;
    }
    for (const n of notes) {
      const start = (cycle * loop + n.startStep) * stepSec;
      const local = start - startSec;
      if (local >= windowSec || local + 2 < 0) continue;
      const dur = Math.max(0.03, n.length * stepSec);
      const osc = offline.createOscillator();
      osc.type = (params.oscType || "sawtooth") as OscillatorType;
      osc.frequency.value = midiToFreq(n.pitch);
      const filter = offline.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = params.cutoff || 1800;
      filter.Q.value = params.resonance || 1;
      const g = offline.createGain();
      const vel = (params.gain || 0.3) * (n.velocity || 0.8);
      const t0 = Math.max(0, local);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel), t0 + (params.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.001, vel * (params.sustain || 0.5)),
        t0 + (params.attack || 0.01) + (params.decay || 0.18),
      );
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + (params.release || 0.2));
      osc.connect(filter).connect(g).connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + (params.release || 0.2) + 0.05);
    }
  }
}

async function scheduleTimelineAudio(
  offline: OfflineAudioContext,
  mixer: Mixer,
  clips: TimelineClip[],
  barSec: number,
  projectBpm: number,
  projectKey: string,
  startSec: number,
  windowSec: number,
  getBuf: (id: string, stem?: string | null) => Promise<AudioBuffer | null>,
): Promise<void> {
  for (const clip of clips) {
    if (!clip.audioFileId) continue;
    const clipStart = clip.startBar * barSec;
    const clipLen = Math.max(0.05, clip.lengthBars * barSec);
    if (clipStart + clipLen <= startSec || clipStart >= startSec + windowSec) continue;
    const buf = await getBuf(clip.audioFileId, clip.stem);
    if (!buf) continue;
    const dest = mixer.clipInput(clip.trackId);
    await scheduleWarpedClip(
      offline,
      buf,
      dest,
      clipStart - startSec,
      clipLen,
      {
        sourceBpm: clip.sourceBpm,
        projectBpm,
        sourceKey: clip.sourceKey,
        projectKey,
        keyFollow: !!clip.keyFollow,
        transpose: clip.transpose,
        gain: clip.gain,
        reverse: !!clip.reverse,
        audioOffsetSec: clip.audioOffsetSec,
      },
      false,
      {
        fadeInSec: Math.max(0, clip.fadeInBars || 0) * barSec,
        fadeOutSec: Math.max(0, clip.fadeOutBars || 0) * barSec,
      },
    );
  }
}
