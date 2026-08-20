/** Bounce the live engine graph (decks + drums + synth + timeline) through OfflineAudioContext. */
import { getEngine } from "./AudioEngine";
import { PAD_IDS } from "./DrumMachine";
import { midiToFreq } from "./demo";
import { equalPower } from "./utils";
import type { MixerStripState, MidiNote, SynthParams, TimelineClip } from "../types";
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
  const deckA = eng.decks.A.buffer;
  const deckB = eng.decks.B.buffer;
  if (deckA) seconds = Math.max(seconds, deckA.duration);
  if (deckB) seconds = Math.max(seconds, deckB.duration);
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
  const master = offline.createGain();
  master.gain.value = eng.mixer.master.volume.gain.value;
  master.connect(offline.destination);

  const xf = equalPower(s.crossfader);
  const anySolo = Object.values(s.mixer).some((ch) => ch.solo);

  const connectStrip = (state: MixerStripState | undefined, xfGain = 1): GainNode => {
    const input = offline.createGain();
    if (!state || state.mute || (anySolo && !state.solo)) {
      input.gain.value = 0;
      input.connect(master);
      return input;
    }
    const vol = offline.createGain();
    vol.gain.value = (state.volume ?? 0.85) * xfGain;
    const pan = offline.createStereoPanner();
    pan.pan.value = state.pan ?? 0;
    const low = offline.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 220;
    low.gain.value = state.eq?.[0] ?? 0;
    const mid = offline.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 0.9;
    mid.gain.value = state.eq?.[1] ?? 0;
    const high = offline.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 4200;
    high.gain.value = state.eq?.[2] ?? 0;
    input.connect(low).connect(mid).connect(high).connect(vol).connect(pan).connect(master);
    return input;
  };

  const inA = connectStrip(s.mixer.A, xf.a);
  const inB = connectStrip(s.mixer.B, xf.b);
  const inDrums = connectStrip(s.mixer.drums);
  const inSynth = connectStrip(s.mixer.synth);

  const transplant = (buf: AudioBuffer): AudioBuffer => {
    const copy = offline.createBuffer(buf.numberOfChannels, buf.length, sr);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      copy.getChannelData(c).set(buf.getChannelData(c).subarray(0, copy.length));
    }
    return copy;
  };

  if (deckA) {
    const src = offline.createBufferSource();
    src.buffer = transplant(deckA);
    src.connect(inA);
    src.start(0);
  }
  if (deckB) {
    const src = offline.createBufferSource();
    src.buffer = transplant(deckB);
    src.connect(inB);
    src.start(0);
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
        src.connect(g).connect(inDrums);
        src.start(when);
      }
    }
  }

  scheduleSynth(offline, inSynth, s.notes, s.synth, s.clips, s.mode, stepSec, seconds);
  scheduleTimelineAudio(offline, inA, inB, s.clips, barSec, (id) => {
    const live = eng.buffers.get(id);
    return live ? transplant(live) : null;
  });

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
): void {
  if (!notes.length) return;
  const loop = 16;
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

function scheduleTimelineAudio(
  offline: OfflineAudioContext,
  inA: AudioNode,
  inB: AudioNode,
  clips: TimelineClip[],
  barSec: number,
  getBuf: (id: string) => AudioBuffer | null,
): void {
  for (const clip of clips) {
    if (clip.kind !== "audio" || !clip.audioFileId) continue;
    const buf = getBuf(clip.audioFileId);
    if (!buf) continue;
    const src = offline.createBufferSource();
    src.buffer = buf;
    const dest = clip.trackId === "deckB" ? inB : inA;
    src.connect(dest);
    src.start(clip.startBar * barSec);
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
