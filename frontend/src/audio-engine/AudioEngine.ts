import { api } from "../api/client";
import { AutomationEngine } from "./AutomationEngine";
import { ClipLauncher } from "./ClipLauncher";
import { Deck } from "./Deck";
import { DrumMachine } from "./DrumMachine";
import { Mixer } from "./Mixer";
import { applyMidiTarget, loadMidiBindings, persistMidiBindings, type MidiBindings } from "./midiMap";
import { PianoRoll } from "./PianoRoll";
import { LiveRecorder } from "./recorder";
import { Sampler } from "./Sampler";
import { Synth } from "./Synth";
import { TimelineEngine } from "./Timeline";
import { Transport } from "./Transport";
import { decodeUrl } from "./utils";
import type { MidiNote, SessionClip, TimelineClip } from "../types";

export class AudioEngine {
  ctx: AudioContext;
  transport: Transport;
  mixer: Mixer;
  decks: { A: Deck; B: Deck };
  drums: DrumMachine;
  synth: Synth;
  sampler: Sampler;
  timeline: TimelineEngine;
  automation: AutomationEngine;
  piano: PianoRoll;
  launcher: ClipLauncher;
  ready = false;
  arrangeMode = false;
  buffers = new Map<string, AudioBuffer>();
  midiBindings: MidiBindings = loadMidiBindings();
  recorder = new LiveRecorder();
  private midiLearn: ((kind: "cc" | "note", number: number) => void) | null = null;
  private clipSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.ctx = new AudioContext();
    this.transport = new Transport(this.ctx);
    this.mixer = new Mixer(this.ctx, this.ctx.destination);
    this.decks = {
      A: new Deck(this.ctx, this.mixer.channels.A.input),
      B: new Deck(this.ctx, this.mixer.channels.B.input),
    };
    this.drums = new DrumMachine(this.ctx, this.mixer.channels.drums.input);
    this.synth = new Synth(this.ctx, this.mixer.channels.synth.input);
    this.sampler = new Sampler(this.ctx, this.mixer.channels.drums.input);
    this.timeline = new TimelineEngine();
    this.automation = new AutomationEngine();
    this.piano = new PianoRoll();
    this.launcher = new ClipLauncher();
  }

  async init(): Promise<void> {
    if (this.ready) return;
    await this.ctx.resume();
    await this.drums.init();
    this.drums.attach(this.transport);
    this.drums.onKick = (time) => this.mixer.duckFromKick(time);
    this.timeline.attach(this.transport);
    this.timeline.setHandler((clip, when) => this.playTimelineClip(clip, when));
    this.piano.attach(this.transport, this.synth);
    this.transport.onTick((step, time) => {
      const seconds = step * this.transport.secondsPerStep;
      this.applyAutomation(seconds);
      if (step % 16 === 0) this.launcher.onBar(Math.floor(step / 16));
      this.syncGating(step);
      void time;
    });
    this.ready = true;
  }

  private syncGating(step: number): void {
    const bar = Math.floor(step / 16);
    if (this.arrangeMode) {
      const inDrums = this.timeline.clips.some(
        (c) => c.trackId === "drums" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
      );
      const inSynth = this.timeline.clips.some(
        (c) => c.trackId === "synth" && bar >= c.startBar && bar < c.startBar + c.lengthBars,
      );
      this.drums.enabled = inDrums;
      this.piano.enabled = inSynth;
    } else {
      const drumClip = this.launcher.active.drums;
      const synthClip = this.launcher.active.synth;
      // Session: if a clip is launched use it; otherwise drums/synth follow the current mode (always on unless empty launch).
      if (drumClip) this.drums.enabled = !drumClip.empty;
      if (synthClip) this.piano.enabled = !synthClip.empty;
    }
  }

  applyAutomation(seconds: number): void {
    const writeKnob = (ch: "A" | "B", v: number) => this.mixer.channels[ch].filter.setKnob(v * 2 - 1);
    this.automation.apply("deck_a.filter.cutoff", seconds, (v) => writeKnob("A", v));
    this.automation.apply("deck_b.filter.cutoff", seconds, (v) => writeKnob("B", v));
    this.automation.apply("deck_a.eq.low", seconds, (v) => {
      const eq = this.mixer.channels.A.eq;
      eq.set(v, eq.mid.gain.value, eq.high.gain.value);
    });
    this.automation.apply("deck_b.eq.low", seconds, (v) => {
      const eq = this.mixer.channels.B.eq;
      eq.set(v, eq.mid.gain.value, eq.high.gain.value);
    });
    this.automation.apply("deck_a.volume", seconds, (v) => this.mixer.channels.A.setVolume(v));
    this.automation.apply("deck_b.volume", seconds, (v) => this.mixer.channels.B.setVolume(v));
    this.automation.apply("master.volume", seconds, (v) => this.mixer.master.setVolume(v));
  }

  playTimelineClip(clip: TimelineClip, when: number): void {
    if (clip.kind === "audio" && clip.audioFileId) {
      const buf = this.buffers.get(clip.audioFileId);
      if (!buf) {
        void this.prefetch(clip.audioFileId);
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const dest = clip.trackId === "deckB" ? this.mixer.channels.B.input : this.mixer.channels.A.input;
      src.connect(dest);
      src.start(when);
      this.clipSources.push(src);
    }
    if (clip.kind === "drums" || clip.trackId === "drums") this.drums.enabled = true;
    if (clip.kind === "midi" || clip.trackId === "synth") this.piano.enabled = true;
  }

  stopClips(): void {
    for (const s of this.clipSources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.clipSources = [];
  }

  async prefetch(audioId: string): Promise<AudioBuffer> {
    if (this.buffers.has(audioId)) return this.buffers.get(audioId)!;
    const buf = await decodeUrl(this.ctx, api.audio.streamUrl(audioId));
    this.buffers.set(audioId, buf);
    return buf;
  }

  async loadDeck(side: "A" | "B", audioId: string, beats: number[] = []): Promise<AudioBuffer> {
    const buffer = await this.prefetch(audioId);
    await this.decks[side].loadBuffer(buffer, beats);
    return buffer;
  }

  launch(trackId: string, scene: number): SessionClip | null {
    const clip = this.launcher.launchClip(trackId, scene);
    if (!clip || clip.empty) {
      if (trackId === "drums") this.drums.enabled = false;
      if (trackId === "synth") this.piano.enabled = false;
      return clip;
    }
    if (clip.kind === "drums") this.drums.enabled = true;
    if (clip.kind === "midi") this.piano.enabled = true;
    return clip;
  }

  setNotes(notes: MidiNote[]): void {
    this.piano.setNotes(notes);
  }

  syncDecks(master: "A" | "B", bpmA?: number, bpmB?: number): void {
    const src = master === "A" ? bpmA : bpmB;
    const dstBpm = master === "A" ? bpmB : bpmA;
    const dest = master === "A" ? this.decks.B : this.decks.A;
    if (src && dstBpm) dest.syncToBpm(dstBpm, src);
  }

  setMidiBindings(bindings: MidiBindings): void {
    this.midiBindings = bindings;
    persistMidiBindings(bindings);
  }

  armMidiLearn(cb: (kind: "cc" | "note", number: number) => void): void {
    this.midiLearn = cb;
  }

  async enableMidi(): Promise<string> {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) return "Web MIDI not supported";
    const access = await nav.requestMIDIAccess();
    access.inputs.forEach((input) => {
      input.onmidimessage = (ev: MIDIMessageEvent) => {
        const d = ev.data;
        if (!d) return;
        const status = d[0] & 0xf0;
        const number = d[1];
        const vel = d[2] / 127;
        if (status === 0xb0) {
          if (this.midiLearn) {
            this.midiLearn("cc", number);
            this.midiLearn = null;
            return;
          }
          const target = this.midiBindings.cc[String(number)];
          if (target) applyMidiTarget(this, target, vel);
          return;
        }
        if (status === 0x90 || status === 0x80) {
          if (this.midiLearn && status === 0x90 && vel > 0) {
            this.midiLearn("note", number);
            this.midiLearn = null;
            return;
          }
          const mapped = this.midiBindings.notes[String(number)];
          if (mapped) {
            applyMidiTarget(this, mapped, vel, status === 0x90 && vel > 0);
            return;
          }
          if (status === 0x90 && vel > 0) this.synth.noteOn(number, vel);
          if (status === 0x80 || (status === 0x90 && vel === 0)) this.synth.noteOff(number);
        }
      };
    });
    return `MIDI inputs: ${[...access.inputs].length} · mapped CC/notes + keys`;
  }

  startRecording(): void {
    this.recorder.start(this.ctx, this.mixer.limiter.output);
  }

  stopRecording(): AudioBuffer | null {
    return this.recorder.stop();
  }
}

let singleton: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}
