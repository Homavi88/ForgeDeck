/**
 * Bitcrusher via AudioWorklet. Falls back to a waveshaper if the
 * worklet module fails to load (some browsers / OfflineAudioContext).
 */
import { bitcrushCurve } from "../analog";

export class BitcrusherFx {
  input: GainNode;
  output: GainNode;
  wet: GainNode;
  dry: GainNode;
  worklet: AudioWorkletNode | null = null;
  private ctx: BaseAudioContext;
  private readyPromise: Promise<void>;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.readyPromise = this.attachWorklet();
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  private async attachWorklet(): Promise<void> {
    try {
      await this.ctx.audioWorklet.addModule("/worklets/bitcrusher-processor.js");
      this.worklet = new AudioWorkletNode(this.ctx, "bitcrusher-processor");
      this.input.connect(this.worklet).connect(this.wet).connect(this.output);
    } catch {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = bitcrushCurve(3);
      this.input.connect(shaper).connect(this.wet).connect(this.output);
    }
  }

  setWet(wet: number): void {
    this.wet.gain.value = wet;
  }
}
