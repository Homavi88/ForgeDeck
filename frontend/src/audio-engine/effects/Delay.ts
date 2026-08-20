export class DelayFx {
  delay: DelayNode;
  feedback: GainNode;
  wet: GainNode;
  dry: GainNode;
  input: GainNode;
  output: GainNode;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.feedback = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.delay.delayTime.value = 0.375;
    this.feedback.gain.value = 0.35;
    this.wet.gain.value = 0;
    this.dry.gain.value = 1;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.wet).connect(this.output);
  }

  set(time: number, feedback: number, wet: number): void {
    this.delay.delayTime.value = time;
    this.feedback.gain.value = feedback;
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet * 0.5;
  }
}
