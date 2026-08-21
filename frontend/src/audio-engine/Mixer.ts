import { ChannelStrip } from "./ChannelStrip";
import { LimiterFx } from "./effects/Compressor";
import { DelayFx } from "./effects/Delay";
import { ReverbFx } from "./effects/Reverb";
import { mixerIdForTrack } from "../lib/mix";
import { xfaderGains, type XfaderCurve } from "./utils";

function isRealtime(ctx: BaseAudioContext): ctx is AudioContext {
  return typeof (ctx as AudioContext).createMediaStreamDestination === "function";
}

export class Mixer {
  ctx: BaseAudioContext;
  channels: Record<string, ChannelStrip>;
  master: ChannelStrip;
  limiter: LimiterFx;
  masterAnalyser: AnalyserNode;
  xfaderA: GainNode;
  xfaderB: GainNode;
  output: AudioNode;
  crossfader = 0.5;
  xfaderCurve: XfaderCurve = "smooth";

  cueBus: GainNode;
  cueMix = 1;
  splitCue = false;
  headphoneMix: GainNode;
  headphoneDest: MediaStreamAudioDestinationNode | null = null;
  returnRev: ReverbFx;
  returnDly: DelayFx;
  returnRevLevel: GainNode;
  returnDlyLevel: GainNode;
  private masterHpGain: GainNode;
  private cueHpGain: GainNode;
  private stereoGate: GainNode;
  private splitGate: GainNode;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
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

    this.returnRev = new ReverbFx(ctx);
    this.returnDly = new DelayFx(ctx);
    this.returnRev.setReturn(1);
    this.returnDly.setReturn(0.375, 0.35, 1);
    this.returnRevLevel = ctx.createGain();
    this.returnDlyLevel = ctx.createGain();
    this.returnRevLevel.gain.value = 0.85;
    this.returnDlyLevel.gain.value = 0.85;
    for (const ch of Object.values(this.channels)) {
      ch.sendRev.connect(this.returnRev.input);
      ch.sendDly.connect(this.returnDly.input);
    }
    this.returnRev.output.connect(this.returnRevLevel).connect(this.master.input);
    this.returnDly.output.connect(this.returnDlyLevel).connect(this.master.input);

    this.master.output.connect(this.limiter.input);
    this.limiter.output.connect(this.masterAnalyser);

    this.stereoGate = ctx.createGain();
    this.splitGate = ctx.createGain();
    this.splitGate.gain.value = 0;
    this.masterAnalyser.connect(this.stereoGate);
    this.stereoGate.connect(destination);

    this.cueBus = ctx.createGain();
    this.channels.A.pflOut.connect(this.cueBus);
    this.channels.B.pflOut.connect(this.cueBus);

    this.masterHpGain = ctx.createGain();
    this.cueHpGain = ctx.createGain();
    this.headphoneMix = ctx.createGain();
    this.masterAnalyser.connect(this.masterHpGain);
    this.cueBus.connect(this.cueHpGain);
    this.masterHpGain.connect(this.headphoneMix);
    this.cueHpGain.connect(this.headphoneMix);
    this.setCueMix(1);

    if (isRealtime(ctx)) {
      this.headphoneDest = ctx.createMediaStreamDestination();
      this.headphoneMix.connect(this.headphoneDest);
    }

    const masterSplit = ctx.createChannelSplitter(2);
    const cueSplit = ctx.createChannelSplitter(2);
    const destMerger = ctx.createChannelMerger(2);
    this.masterAnalyser.connect(masterSplit);
    this.cueBus.connect(cueSplit);
    masterSplit.connect(destMerger, 0, 0);
    cueSplit.connect(destMerger, 0, 1);
    destMerger.connect(this.splitGate);
    this.splitGate.connect(destination);

    this.output = destination;
    this.setCrossfader(0.5);
  }

  /** Extra arrange/audio lanes feed master (not the DJ xfader). */
  addLane(id: string): ChannelStrip {
    const existing = this.channels[id];
    if (existing) return existing;
    const ch = new ChannelStrip(this.ctx);
    this.channels[id] = ch;
    ch.output.connect(this.master.input);
    ch.sendRev.connect(this.returnRev.input);
    ch.sendDly.connect(this.returnDly.input);
    ch.pflOut.connect(this.cueBus);
    void ch.fx.ready();
    return ch;
  }

  removeLane(id: string): void {
    if (id === "A" || id === "B" || id === "drums" || id === "synth") return;
    const ch = this.channels[id];
    if (!ch) return;
    for (const node of [ch.output, ch.sendRev, ch.sendDly, ch.pflOut]) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    delete this.channels[id];
  }

  clipInput(trackId: string): AudioNode {
    const id = mixerIdForTrack(trackId);
    return this.channels[id]?.input ?? this.channels.A.input;
  }

  async ready(): Promise<void> {
    await Promise.all([
      ...Object.values(this.channels).map((ch) => ch.fx.ready()),
      this.master.fx.ready(),
    ]);
  }

  setXfaderCurve(curve: XfaderCurve): void {
    this.xfaderCurve = curve;
    this.setCrossfader(this.crossfader);
  }

  setCrossfader(x: number): void {
    this.crossfader = x;
    const { a, b } = xfaderGains(x, this.xfaderCurve);
    this.xfaderA.gain.value = a;
    this.xfaderB.gain.value = b;
  }

  setPfl(id: string, on: boolean): void {
    this.channels[id]?.setPfl(on);
  }

  setCueMix(v: number): void {
    this.cueMix = Math.max(0, Math.min(1, v));
    this.masterHpGain.gain.value = 1 - this.cueMix;
    this.cueHpGain.gain.value = this.cueMix;
  }

  setSplitCue(on: boolean): void {
    this.splitCue = on;
    this.stereoGate.gain.value = on ? 0 : 1;
    this.splitGate.gain.value = on ? 1 : 0;
  }

  setReturnLevel(kind: "reverb" | "delay", v: number): void {
    const g = Math.max(0, Math.min(1.5, v));
    if (kind === "reverb") this.returnRevLevel.gain.value = g;
    else this.returnDlyLevel.gain.value = g;
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
