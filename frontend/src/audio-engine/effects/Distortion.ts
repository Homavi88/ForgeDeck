function curve(amount: number): Float32Array<ArrayBuffer> {
  const n = 44100;
  const samples = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount * 20;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    samples[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return samples;
}

export class DistortionFx {
  shaper: WaveShaperNode;
  wet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = curve(0.4);
    this.shaper.oversample = "2x";
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.shaper).connect(this.wet).connect(this.output);
  }

  set(drive: number, wet: number): void {
    this.shaper.curve = curve(drive);
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet * 0.5;
  }
}
