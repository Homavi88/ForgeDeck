import { ChannelStrip } from "./ChannelStrip";
import { LimiterFx } from "./effects/Compressor";
import { equalPower } from "./utils";

export class Mixer {
  channels: Record<string, ChannelStrip>;
  master: ChannelStrip;
  limiter: LimiterFx;
  masterAnalyser: AnalyserNode;
  xfaderA: GainNode;
  xfaderB: GainNode;
  output: AudioNode;
  private ctx: AudioContext;
  crossfader = 0.5;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.channels = {
      A: new ChannelStrip(ctx),
      B: new ChannelStrip(ctx),
      drums: new ChannelStrip(ctx),
      synth: new ChannelStrip(ctx),
    };
    this.master = new ChannelStrip(ctx);
    this.limiter = new LimiterFx(ctx);
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.xfaderA = ctx.createGain();
    this.xfaderB = ctx.createGain();

    this.channels.A.output.connect(this.xfaderA);
    this.channels.B.output.connect(this.xfaderB);
    this.xfaderA.connect(this.master.input);
    this.xfaderB.connect(this.master.input);
    this.channels.drums.output.connect(this.master.input);
    this.channels.synth.output.connect(this.master.input);
    this.master.output.connect(this.limiter.input);
    this.limiter.output.connect(this.masterAnalyser);
    this.masterAnalyser.connect(destination);
    this.output = destination;
    this.setCrossfader(0.5);
  }

  setCrossfader(x: number): void {
    this.crossfader = x;
    const { a, b } = equalPower(x);
    this.xfaderA.gain.value = a;
    this.xfaderB.gain.value = b;
  }

  applySolo(): void {
    const anySolo = Object.values(this.channels).some((ch) => ch.soloed);
    for (const ch of Object.values(this.channels)) {
      if (ch.muted) {
        ch.mute.gain.value = 0;
      } else if (anySolo) {
        ch.mute.gain.value = ch.soloed ? 1 : 0;
      } else {
        ch.mute.gain.value = 1;
      }
    }
  }

  setSolo(id: string, on: boolean): void {
    this.channels[id]?.setSolo(on);
    this.applySolo();
  }

  sidechain = true;

  duckFromKick(time: number): void {
    if (!this.sidechain) return;
    this.channels.synth.duckKick(time, 0.55, 0.18);
    this.channels.A.duckKick(time, 0.25, 0.14);
    this.channels.B.duckKick(time, 0.25, 0.14);
  }

  get masterLevel(): number {
    const data = new Uint8Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }
}
