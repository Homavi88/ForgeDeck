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
    const anySolo = Object.values(this.channels).some((ch) => (ch as unknown as { soloed?: boolean }).soloed);
    // Simple mute-others: if any channel mute is used, user still has mute buttons.
    void anySolo;
    void this.ctx;
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
