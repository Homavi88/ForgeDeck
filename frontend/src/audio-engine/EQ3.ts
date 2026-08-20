/**
 * 3-band DJ EQ: lowshelf + peaking + highshelf.
 * Range typically ±12 dB. At 0 dB the filters are still in the graph
 * (constant CPU, no zipper from connect/disconnect).
 * Isolator kills drop a band ~−72 dB (Pioneer-style) without losing the knob value.
 */
export class EQ3 {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  input: BiquadFilterNode;
  output: BiquadFilterNode;
  user: [number, number, number] = [0, 0, 0];
  kills: [boolean, boolean, boolean] = [false, false, false];
  private static readonly KILL_DB = -72;

  constructor(ctx: BaseAudioContext) {
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
    this.user = [low, mid, high];
    this.apply();
  }

  setKill(band: 0 | 1 | 2, on: boolean): void {
    this.kills[band] = on;
    this.apply();
  }

  setKills(kills: [boolean, boolean, boolean]): void {
    this.kills = [kills[0], kills[1], kills[2]];
    this.apply();
  }

  private apply(): void {
    const k = EQ3.KILL_DB;
    this.low.gain.value = this.kills[0] ? k : this.user[0];
    this.mid.gain.value = this.kills[1] ? k : this.user[1];
    this.mid.Q.value = this.kills[1] ? 2.4 : 0.9;
    this.high.gain.value = this.kills[2] ? k : this.user[2];
  }
}
