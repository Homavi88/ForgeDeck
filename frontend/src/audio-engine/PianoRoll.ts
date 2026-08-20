import type { MidiNote } from "../types";
import type { Synth } from "./Synth";
import type { Transport } from "./Transport";

export class PianoRoll {
  notes: MidiNote[] = [];
  loopSteps = 16;
  enabled = true;
  private held = new Set<number>();

  setNotes(notes: MidiNote[]): void {
    this.notes = notes;
  }

  setLoopSteps(n: number): void {
    this.loopSteps = Math.max(1, n);
  }

  attach(transport: Transport, synth: Synth): void {
    transport.onTick((step, time) => {
      if (!this.enabled) return;
      const loop = Math.max(1, this.loopSteps);
      const idx = step % loop;
      const toOn = new Map<number, number>();
      const toOff = new Set<number>();
      for (const n of this.notes) {
        if (n.startStep === idx) toOn.set(n.pitch, n.velocity);
        if ((n.startStep + n.length) % loop === idx) toOff.add(n.pitch);
      }
      for (const p of toOff) {
        if (toOn.has(p)) continue;
        synth.noteOff(p);
        this.held.delete(p);
      }
      for (const [p, vel] of toOn) {
        synth.noteOn(p, vel);
        this.held.add(p);
      }
      void time;
    });
  }

  toggleNote(pitch: number, startStep: number, length = 1): MidiNote[] {
    const existing = this.notes.find((n) => n.pitch === pitch && n.startStep === startStep);
    if (existing) this.notes = this.notes.filter((n) => n !== existing);
    else
      this.notes = [
        ...this.notes,
        { id: crypto.randomUUID(), pitch, startStep, length, velocity: 0.8 },
      ];
    return this.notes;
  }
}
