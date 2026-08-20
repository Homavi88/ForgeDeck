import { analogReverbIR, analogTapeEchoIR } from "../analog";

export class ReverbFx {
  conv: ConvolverNode;
  tape: ConvolverNode;
  wet: GainNode;
  tapeWet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.conv = ctx.createConvolver();
    this.conv.normalize = true;
    this.conv.buffer = analogReverbIR(ctx);
    this.tape = ctx.createConvolver();
    this.tape.normalize = true;
    this.tape.buffer = analogTapeEchoIR(ctx);
    this.wet = ctx.createGain();
    this.tapeWet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.tapeWet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.conv).connect(this.wet).connect(this.output);
    this.input.connect(this.tape).connect(this.tapeWet).connect(this.output);
  }

  setWet(wet: number): void {
    this.wet.gain.value = wet;
    this.tapeWet.gain.value = wet * 0.22;
    this.dry.gain.value = 1 - wet * 0.4;
  }

  /** 100% wet, no dry — mix-bus return. */
  setReturn(wet = 1): void {
    this.wet.gain.value = wet;
    this.tapeWet.gain.value = wet * 0.22;
    this.dry.gain.value = 0;
  }
}
