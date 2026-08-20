import type { DrumSteps } from "../types";
import { makeDefaultKit } from "./demo";
import type { Transport } from "./Transport";

export const PAD_IDS = [
  "kick",
  "snare",
  "hat",
  "clap",
  "perc",
  "ride",
  "tom",
  "fx",
  "kick2",
  "snare2",
  "ohat",
  "rim",
  "shaker",
  "cowbell",
  "stab",
  "vox",
] as const;

export class DrumMachine {
  ctx: AudioContext;
  output: GainNode;
  pads: Record<string, AudioBuffer | null> = {};
  steps: DrumSteps = {};
  length = 16;
  swing = 0.08;
  muted: Record<string, boolean> = {};
  enabled = true;
  onKick?: (time: number) => void;
  private unsubscribe?: () => void;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 0.9;
    this.output.connect(destination);
    for (const id of PAD_IDS) this.steps[id] = Array(64).fill(0);
  }

  async init(): Promise<void> {
    const kit = await makeDefaultKit(this.ctx);
    for (const id of PAD_IDS) {
      this.pads[id] = kit[id] || kit.perc || kit.hat;
    }
  }

  attach(transport: Transport): void {
    this.unsubscribe?.();
    this.unsubscribe = transport.onTick((step, time) => {
      if (!this.enabled) return;
      const idx = step % this.length;
      const swingDelay = idx % 2 === 1 ? this.swing * transport.secondsPerStep : 0;
      for (const id of PAD_IDS) {
        if (this.muted[id]) continue;
        const vel = this.steps[id]?.[idx] ?? 0;
        if (vel > 0) this.trigger(id, time + swingDelay, vel);
      }
    });
  }

  trigger(id: string, time = this.ctx.currentTime, velocity = 1): void {
    const buf = this.pads[id];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = velocity;
    src.connect(g).connect(this.output);
    src.start(time);
    if (id === "kick" || id === "kick2") this.onKick?.(time);
  }

  setStep(id: string, index: number, velocity: number): void {
    if (!this.steps[id]) this.steps[id] = Array(64).fill(0);
    this.steps[id][index] = velocity;
  }

  assign(id: string, buffer: AudioBuffer): void {
    this.pads[id] = buffer;
  }
}
