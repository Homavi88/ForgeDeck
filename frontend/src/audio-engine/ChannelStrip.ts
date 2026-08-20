import { EQ3 } from "./EQ3";
import { EffectChain } from "./EffectChain";
import { Filter } from "./Filter";
import { dbToGain } from "./utils";

export class ChannelStrip {
  input: GainNode;
  output: GainNode;
  trim: GainNode;
  eq: EQ3;
  filter: Filter;
  fx: EffectChain;
  mute: GainNode;
  volume: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  duck: GainNode;
  /** Pre-fader listen tap (after FX/duck, before mute/volume). */
  pflOut: GainNode;
  muted = false;
  soloed = false;

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.trim = ctx.createGain();
    this.eq = new EQ3(ctx);
    this.filter = new Filter(ctx);
    this.fx = new EffectChain(ctx);
    this.duck = ctx.createGain();
    this.pflOut = ctx.createGain();
    this.pflOut.gain.value = 0;
    this.mute = ctx.createGain();
    this.volume = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.output = ctx.createGain();
    this.volume.gain.value = 0.85;

    this.input
      .connect(this.trim)
      .connect(this.eq.input);
    this.eq.output.connect(this.filter.input);
    this.filter.output.connect(this.fx.input);
    this.fx.output.connect(this.duck);
    this.duck.connect(this.mute);
    this.duck.connect(this.pflOut);
    this.mute
      .connect(this.volume)
      .connect(this.panner)
      .connect(this.analyser)
      .connect(this.output);
  }

  setPfl(on: boolean): void {
    this.pflOut.gain.value = on ? 1 : 0;
  }

  setGainDb(db: number): void {
    this.trim.gain.value = dbToGain(db);
  }

  setVolume(v: number): void {
    this.volume.gain.value = v;
  }

  setPan(v: number): void {
    this.panner.pan.value = v;
  }

  setMute(on: boolean): void {
    this.muted = on;
    this.mute.gain.value = on ? 0 : 1;
  }

  setSolo(_on: boolean): void {
    this.soloed = _on;
  }

  duckKick(time: number, amount = 0.45, recovery = 0.16): void {
    const g = this.duck.gain;
    g.cancelScheduledValues(time);
    g.setValueAtTime(Math.max(0.05, 1 - amount), time);
    g.exponentialRampToValueAtTime(1, time + recovery);
  }

  get level(): number {
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const x = (data[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / data.length);
  }
}
