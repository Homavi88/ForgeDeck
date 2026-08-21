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

  static params(knob: number): { type: BiquadFilterType; freq: number; q: number } {
    const k = Math.max(-1, Math.min(1, knob));
    if (Math.abs(k) < 0.02) return { type: "lowpass", freq: 18000, q: 0.7 };
    if (k < 0) {
      const t = -k;
      return { type: "lowpass", freq: 18000 * Math.pow(80 / 18000, t), q: 0.7 + t * 6 };
    }
    return { type: "highpass", freq: 40 * Math.pow(8000 / 40, k), q: 0.7 + k * 5 };
  }

  /** knob in [-1, 1]. Optional `when` schedules frequency/Q (type is not an AudioParam). */
  setKnob(knob: number, when?: number): void {
    const k = Math.max(-1, Math.min(1, knob));
    this.knob = k;
    const p = Filter.params(k);
    this.node.type = p.type;
    if (when != null && Number.isFinite(when)) {
      this.node.frequency.setValueAtTime(p.freq, when);
      this.node.Q.setValueAtTime(p.q, when);
    } else {
      this.node.frequency.value = p.freq;
      this.node.Q.value = p.q;
    }
  }
}
