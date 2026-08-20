import type { OscType, SynthParams } from "../types";
import { midiToFreq } from "./demo";

interface Voice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
}

const DEFAULTS: SynthParams = {
  oscType: "sawtooth",
  gain: 0.32,
  attack: 0.01,
  decay: 0.18,
  sustain: 0.55,
  release: 0.25,
  cutoff: 1800,
  resonance: 4,
  lfoRate: 4.5,
  lfoDepth: 400,
  lfoTarget: "filter",
  poly: true,
};

export class Synth {
  ctx: AudioContext;
  output: GainNode;
  params: SynthParams = { ...DEFAULTS };
  private voices = new Map<number, Voice>();

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 1;
    this.output.connect(destination);
  }

  setParams(patch: Partial<SynthParams>): void {
    this.params = { ...this.params, ...patch };
  }

  noteOn(midi: number, velocity = 0.8): void {
    if (!this.params.poly) this.allOff();
    if (this.voices.has(midi)) this.noteOff(midi);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = this.params.oscType as OscillatorType;
    osc.frequency.value = midiToFreq(midi);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.params.cutoff;
    filter.Q.value = this.params.resonance;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.params.gain * velocity), t + this.params.attack);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, this.params.gain * this.params.sustain * velocity),
      t + this.params.attack + this.params.decay,
    );
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = this.params.lfoRate;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = this.params.lfoDepth;
    lfo.connect(lfoGain);
    if (this.params.lfoTarget === "filter") lfoGain.connect(filter.frequency);
    else lfoGain.connect(osc.frequency);
    lfo.start();
    osc.connect(filter).connect(gain).connect(this.output);
    osc.start();
    this.voices.set(midi, { osc, filter, gain, lfo });
  }

  noteOff(midi: number): void {
    const voice = this.voices.get(midi);
    if (!voice) return;
    const t = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), t);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + this.params.release);
    voice.osc.stop(t + this.params.release + 0.02);
    voice.lfo.stop(t + this.params.release + 0.02);
    this.voices.delete(midi);
  }

  allOff(): void {
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
  }

  setOsc(type: OscType): void {
    this.params.oscType = type;
  }
}
