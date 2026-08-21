/** Bounce 1:1: same ChannelStrip / analog+convolution FX / limiter graph as the live mixer. */
import { getEngine } from "./AudioEngine";
import { Mixer } from "./Mixer";
import { PAD_IDS } from "./DrumMachine";
import { midiToFreq } from "./demo";
import { applyKeyLock, createKeyLockNode } from "./rubberband";
import { applyStripState, snapshotStrip } from "./stripState";
import { scheduleWarpedClip } from "./clipPlayback";
import type { MidiNote, SynthParams, TimelineClip } from "../types";
import { useStudio } from "../store/useStudio";

export async function renderOfflineWav(): Promise<Blob> {
  const eng = getEngine();
  await eng.init();
  const s = useStudio.getState();
  const sr = eng.ctx.sampleRate;
  const bpm = s.bpm || 120;
  const barSec = (60 / bpm) * 4;
  const stepSec = barSec / 16;

  let seconds = 8;
  const cover = (duration: number, rate: number) => {
    seconds = Math.max(seconds, duration / Math.max(0.05, rate));
  };
  for (const side of ["A", "B"] as const) {
    const deck = eng.decks[side];
    if (eng.stemsActive[side]) {
      for (const d of Object.values(eng.stemDecks[side])) {
        if (d.buffer) cover(d.buffer.duration, d.rate);
      }
    } else if (deck.buffer) {
      cover(deck.buffer.duration, deck.rate);
    }
  }
  for (const clip of s.clips) {
    seconds = Math.max(seconds, (clip.startBar + clip.lengthBars) * barSec);
  }
  for (const n of s.notes) {
    seconds = Math.max(seconds, ((n.startStep + n.length) / 16) * barSec);
  }
  const hasDrums = PAD_IDS.some((id) => (s.drumSteps[id] || []).some((v) => v > 0));
  if (hasDrums) seconds = Math.max(seconds, 8 * barSec);
  seconds = Math.min(Math.max(seconds, 4), 8 * 60);

  const length = Math.max(1, Math.floor(sr * seconds));
  const offline = new OfflineAudioContext(2, length, sr);
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
  applyStripState(mixer.master, snapshotStrip(eng.mixer.master));
  mixer.setXfaderCurve(eng.mixer.xfaderCurve);
  mixer.setCrossfader(eng.mixer.crossfader);
  mixer.sidechain = eng.mixer.sidechain;
  mixer.setReturnLevel("reverb", eng.mixer.returnRevLevel.gain.value);
  mixer.setReturnLevel("delay", eng.mixer.returnDlyLevel.gain.value);
  mixer.applySolo();

  const transplant = (buf: AudioBuffer): AudioBuffer => {
    const copy = offline.createBuffer(buf.numberOfChannels, buf.length, sr);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      copy.getChannelData(c).set(buf.getChannelData(c).subarray(0, copy.length));
    }
    return copy;
  };

  const feed = async (
    buf: AudioBuffer | null,
    dest: AudioNode,
    rate: number,
    keyLock: boolean,
    when = 0,
  ): Promise<void> => {
    if (!buf) return;
    const src = offline.createBufferSource();
    src.buffer = transplant(buf);
    if (keyLock) {
      const rb = await createKeyLockNode(offline);
      if (rb) {
        src.playbackRate.value = rate;
        src.connect(rb);
        rb.connect(dest);
        applyKeyLock(rb, rate);
        src.start(when);
        return;
      }
    }
    src.playbackRate.value = rate;
    src.connect(dest);
    src.start(when);
  };

  for (const side of ["A", "B"] as const) {
    const dest = mixer.channels[side].input;
    const master = eng.decks[side];
    if (eng.stemsActive[side]) {
      for (const [name, d] of Object.entries(eng.stemDecks[side])) {
        if (s.stemMute[name]) continue;
        await feed(d.buffer, dest, master.rate, master.keyLock);
      }
    } else {
      await feed(master.buffer, dest, master.rate, master.keyLock);
    }
  }

  if (hasDrums) {
    const lengthSteps = Math.max(1, s.drumLength || 16);
    const totalSteps = Math.ceil(seconds / stepSec);
    for (let step = 0; step < totalSteps; step++) {
      const idx = step % lengthSteps;
      const swing = idx % 2 === 1 ? (s.drumSwing || 0) * stepSec : 0;
      const when = step * stepSec + swing;
      const bar = Math.floor(step / 16);
      if (s.mode === "arrange") {
        const inClip = s.clips.some(
          (c) => c.trackId === "drums" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
        );
        if (!inClip) continue;
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
        src.start(when);
        if (id === "kick" || id === "kick2") mixer.duckFromKick(when);
      }
    }
  }

  scheduleSynth(offline, mixer.channels.synth.input, s.notes, s.synth, s.clips, s.mode, stepSec, seconds, Math.max(16, s.drumLength || 16));
  await scheduleTimelineAudio(
    offline,
    mixer,
    s.clips,
    barSec,
    s.bpm,
    s.musicalKey,
    async (id, stem) => {
      const key = eng.bufferKey(id, stem);
      const live = eng.buffers.get(key) || (!stem ? eng.buffers.get(id) : undefined);
      return live ? transplant(live) : null;
    },
  );

  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}

function scheduleSynth(
  offline: OfflineAudioContext,
  dest: AudioNode,
  notes: MidiNote[],
  params: SynthParams,
  clips: TimelineClip[],
  mode: string,
  stepSec: number,
  seconds: number,
  loop: number,
): void {
  if (!notes.length) return;
  const totalSteps = Math.ceil(seconds / stepSec);
  for (let cycle = 0; cycle * loop < totalSteps; cycle++) {
    const bar = Math.floor((cycle * loop) / 16);
    if (mode === "arrange") {
      const inClip = clips.some(
        (c) => c.trackId === "synth" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
      );
      if (!inClip) continue;
    }
    for (const n of notes) {
      const start = (cycle * loop + n.startStep) * stepSec;
      if (start >= seconds) continue;
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
      const t0 = start;
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
  getBuf: (id: string, stem?: string | null) => Promise<AudioBuffer | null>,
): Promise<void> {
  for (const clip of clips) {
    if (clip.kind !== "audio" || !clip.audioFileId) continue;
    const buf = await getBuf(clip.audioFileId, clip.stem);
    if (!buf) continue;
    const dest = mixer.clipInput(clip.trackId);
    await scheduleWarpedClip(
      offline,
      buf,
      dest,
      clip.startBar * barSec,
      Math.max(0.05, clip.lengthBars * barSec),
      {
        sourceBpm: clip.sourceBpm,
        projectBpm,
        sourceKey: clip.sourceKey,
        projectKey,
        keyFollow: !!clip.keyFollow,
      },
      false,
      {
        fadeInSec: Math.max(0, clip.fadeInBars || 0) * barSec,
        fadeOutSec: Math.max(0, clip.fadeOutBars || 0) * barSec,
      },
    );
  }
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const length = buffer.length * ch * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length - 44, true);
  let offset = 44;
  const channels = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}
