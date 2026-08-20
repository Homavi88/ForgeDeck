import { BitcrusherFx } from "./effects/Bitcrusher";
import { CompressorFx } from "./effects/Compressor";
import { DelayFx } from "./effects/Delay";
import { DistortionFx } from "./effects/Distortion";
import { FlangerFx } from "./effects/Flanger";
import { ReverbFx } from "./effects/Reverb";

export class EffectChain {
  input: GainNode;
  output: GainNode;
  delay: DelayFx;
  reverb: ReverbFx;
  flanger: FlangerFx;
  crush: BitcrusherFx;
  dist: DistortionFx;
  comp: CompressorFx;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = new DelayFx(ctx);
    this.reverb = new ReverbFx(ctx);
    this.flanger = new FlangerFx(ctx);
    this.crush = new BitcrusherFx(ctx);
    this.dist = new DistortionFx(ctx);
    this.comp = new CompressorFx(ctx);

    this.input
      .connect(this.comp.input)
      .connect(this.dist.input);
    this.dist.output.connect(this.crush.input);
    this.crush.output.connect(this.flanger.input);
    this.flanger.output.connect(this.delay.input);
    this.delay.output.connect(this.reverb.input);
    this.reverb.output.connect(this.output);
  }

  setWet(kind: string, wet: number): void {
    if (kind === "delay") this.delay.set(0.375, 0.35, wet);
    if (kind === "reverb") this.reverb.setWet(wet);
    if (kind === "flanger") this.flanger.setWet(wet);
    if (kind === "bitcrush") this.crush.setWet(wet);
    if (kind === "distortion") this.dist.set(0.5, wet);
  }
}
