import type { FxInsertKind } from "../lib/mix";
import { BitcrusherFx } from "./effects/Bitcrusher";
import { CompressorFx } from "./effects/Compressor";
import { DelayFx } from "./effects/Delay";
import { DistortionFx } from "./effects/Distortion";
import { FlangerFx } from "./effects/Flanger";
import { ReverbFx } from "./effects/Reverb";

export type FxPort = { input: AudioNode; output: AudioNode };

/** Insert FX devices. Serial order is owned by ChannelStrip.wireInserts — not this constructor. */
export class EffectChain {
  input: GainNode;
  output: GainNode;
  delay: DelayFx;
  reverb: ReverbFx;
  flanger: FlangerFx;
  crush: BitcrusherFx;
  dist: DistortionFx;
  comp: CompressorFx;
  /** 0 = stock compressor settings used by the live desk. */
  compAmount = 0;
  bypassed: Record<string, boolean> = {};
  private lastWet: Record<string, number> = {};

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = new DelayFx(ctx);
    this.reverb = new ReverbFx(ctx);
    this.flanger = new FlangerFx(ctx);
    this.crush = new BitcrusherFx(ctx);
    this.dist = new DistortionFx(ctx);
    this.comp = new CompressorFx(ctx);
  }

  port(kind: FxInsertKind): FxPort {
    if (kind === "compressor") return { input: this.comp.input, output: this.comp.output };
    if (kind === "distortion") return { input: this.dist.input, output: this.dist.output };
    if (kind === "bitcrush") return { input: this.crush.input, output: this.crush.output };
    if (kind === "flanger") return { input: this.flanger.input, output: this.flanger.output };
    if (kind === "delay") return { input: this.delay.input, output: this.delay.output };
    return { input: this.reverb.input, output: this.reverb.output };
  }

  ready(): Promise<void> {
    return this.crush.ready();
  }

  setWet(kind: string, wet: number): void {
    this.lastWet[kind] = Math.max(0, Math.min(1, wet));
    this.applyKind(kind);
  }

  setBypass(kind: string, on: boolean): void {
    this.bypassed[kind] = on;
    this.applyKind(kind);
  }

  private applyKind(kind: string): void {
    const w = this.bypassed[kind] ? 0 : (this.lastWet[kind] ?? 0);
    if (kind === "delay") this.delay.set(0.375, 0.35, w);
    if (kind === "reverb") this.reverb.setWet(w);
    if (kind === "flanger") this.flanger.setWet(w);
    if (kind === "bitcrush") this.crush.setWet(w);
    if (kind === "distortion") this.dist.set(0.55, w);
    if (kind === "compressor") {
      this.compAmount = w;
      if (w <= 0.001) {
        this.comp.node.threshold.value = -18;
        this.comp.node.ratio.value = 4;
      } else {
        this.comp.node.threshold.value = -18 - w * 10;
        this.comp.node.ratio.value = 4 + w * 8;
      }
    }
  }
}
