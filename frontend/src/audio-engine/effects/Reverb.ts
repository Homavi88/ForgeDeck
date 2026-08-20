import { impulseResponse } from "../utils";

export class ReverbFx {
  conv: ConvolverNode;
  wet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.conv = ctx.createConvolver();
    this.conv.buffer = impulseResponse(ctx, 1.8, 2.4);
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.conv).connect(this.wet).connect(this.output);
  }

  setWet(wet: number): void {
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet * 0.4;
  }
}
