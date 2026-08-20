import { api } from "../api/client";
import { AutomationEngine } from "./AutomationEngine";
import { Deck } from "./Deck";
import { DrumMachine } from "./DrumMachine";
import { Mixer } from "./Mixer";
import { Sampler } from "./Sampler";
import { Synth } from "./Synth";
import { TimelineEngine } from "./Timeline";
import { Transport } from "./Transport";
import { decodeUrl } from "./utils";

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
  ready = false;

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
  }

  async init(): Promise<void> {
    if (this.ready) return;
    await this.ctx.resume();
    await this.drums.init();
    this.drums.attach(this.transport);
    this.timeline.attach(this.transport);
    this.timeline.setHandler((clip, when) => {
      // Timeline clip playback uses sampler one-shots for MVP.
      void when;
      void clip;
    });
    this.ready = true;
  }

  async loadDeck(side: "A" | "B", audioId: string): Promise<AudioBuffer> {
    const url = api.audio.streamUrl(audioId);
    const buffer = await decodeUrl(this.ctx, url);
    await this.decks[side].loadBuffer(buffer);
    return buffer;
  }

  syncDecks(master: "A" | "B", bpmA?: number, bpmB?: number): void {
    const src = master === "A" ? bpmA : bpmB;
    const dstBpm = master === "A" ? bpmB : bpmA;
    const dest = master === "A" ? this.decks.B : this.decks.A;
    if (src && dstBpm) dest.syncToBpm(dstBpm, src);
  }

  async enableMidi(onNote: (midi: number, vel: number, on: boolean) => void): Promise<string> {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) return "Web MIDI not supported";
    const access = await nav.requestMIDIAccess();
    access.inputs.forEach((input) => {
      input.onmidimessage = (ev: MIDIMessageEvent) => {
        const d = ev.data;
        if (!d) return;
        const status = d[0] & 0xf0;
        const note = d[1];
        const vel = d[2] / 127;
        if (status === 0x90 && vel > 0) onNote(note, vel, true);
        if (status === 0x80 || (status === 0x90 && vel === 0)) onNote(note, 0, false);
      };
    });
    return `MIDI inputs: ${[...access.inputs].length}`;
  }
}

let singleton: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}
