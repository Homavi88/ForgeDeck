/**
 * Pioneer-style bipolar filter knob.
 * 0 = bypass (very wide), negative = low-pass, positive = high-pass.
 */
export class Filter {
  node: BiquadFilterNode;
  input: BiquadFilterNode;
  output: BiquadFilterNode;
  knob = 0;

  constructor(ctx: BaseAudioContext) {
    this.node = ctx.createBiquadFilter();
    this.node.type = "lowpass";
    this.node.frequency.value = 18000;
    this.node.Q.value = 0.7;
    this.input = this.node;
    this.output = this.node;
  }

  /** knob in [-1, 1] */
  setKnob(knob: number): void {
    const k = Math.max(-1, Math.min(1, knob));
    this.knob = k;
    if (Math.abs(k) < 0.02) {
      this.node.type = "lowpass";
      this.node.frequency.value = 18000;
      this.node.Q.value = 0.7;
      return;
    }
    if (k < 0) {
      this.node.type = "lowpass";
      const t = -k;
      this.node.frequency.value = 18000 * Math.pow(80 / 18000, t);
      this.node.Q.value = 0.7 + t * 6;
    } else {
      this.node.type = "highpass";
      this.node.frequency.value = 40 * Math.pow(8000 / 40, k);
      this.node.Q.value = 0.7 + k * 5;
    }
  }
}
