/**
 * Bitcrusher via AudioWorklet. Falls back to a simple waveshaper if the
 * worklet module fails to load (some browsers / file://).
 */
export class BitcrusherFx {
  input: GainNode;
  output: GainNode;
  wet: GainNode;
  dry: GainNode;
  worklet: AudioWorkletNode | null = null;
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    void this.attachWorklet();
  }

  private async attachWorklet(): Promise<void> {
    try {
      await this.ctx.audioWorklet.addModule("/worklets/bitcrusher-processor.js");
      this.worklet = new AudioWorkletNode(this.ctx, "bitcrusher-processor");
      this.input.connect(this.worklet).connect(this.wet).connect(this.output);
    } catch {
      const shaper = this.ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = i / 128 - 1;
        curve[i] = Math.round(x * 8) / 8;
      }
      shaper.curve = curve;
      this.input.connect(shaper).connect(this.wet).connect(this.output);
    }
  }

  setWet(wet: number): void {
    this.wet.gain.value = wet;
  }
}
