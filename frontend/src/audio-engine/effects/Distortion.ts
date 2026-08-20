import { analogCabinetIR, analogDriveCurve } from "../analog";

export class DistortionFx {
  shaper: WaveShaperNode;
  cabinet: ConvolverNode;
  wet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = analogDriveCurve(0.4);
    this.shaper.oversample = "2x";
    this.cabinet = ctx.createConvolver();
    this.cabinet.normalize = true;
    this.cabinet.buffer = analogCabinetIR(ctx);
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.shaper).connect(this.cabinet).connect(this.wet).connect(this.output);
  }

  set(drive: number, wet: number): void {
    this.shaper.curve = analogDriveCurve(drive);
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet * 0.5;
  }
}
