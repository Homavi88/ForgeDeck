/**
 * 3-band DJ EQ: lowshelf + peaking + highshelf.
 * Range typically ±12 dB. At 0 dB the filters are still in the graph
 * (constant CPU, no zipper from connect/disconnect).
 */
export class EQ3 {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  input: BiquadFilterNode;
  output: BiquadFilterNode;

  constructor(ctx: AudioContext) {
    this.low = ctx.createBiquadFilter();
    this.mid = ctx.createBiquadFilter();
    this.high = ctx.createBiquadFilter();
    this.low.type = "lowshelf";
    this.low.frequency.value = 220;
    this.mid.type = "peaking";
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.9;
    this.high.type = "highshelf";
    this.high.frequency.value = 4200;
    this.low.connect(this.mid);
    this.mid.connect(this.high);
    this.input = this.low;
    this.output = this.high;
  }

  set(low: number, mid: number, high: number): void {
    this.low.gain.value = low;
    this.mid.gain.value = mid;
    this.high.gain.value = high;
  }
}
