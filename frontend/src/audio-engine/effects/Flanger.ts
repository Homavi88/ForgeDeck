/**
 * Cheap flanger: modulated delay + feedback.
 * Phaser would use allpass cascade; this covers both UX slots in MVP.
 */
export class FlangerFx {
  delay: DelayNode;
  lfo: OscillatorNode;
  depth: GainNode;
  wet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = ctx.createDelay(0.05);
    this.delay.delayTime.value = 0.008;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.35;
    this.depth = ctx.createGain();
    this.depth.gain.value = 0.004;
    this.lfo.connect(this.depth).connect(this.delay.delayTime);
    this.lfo.start();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.delay).connect(this.wet).connect(this.output);
  }

  setWet(wet: number): void {
    this.wet.gain.value = wet;
  }
}
