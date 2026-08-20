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

  attach(transport: Transport, synth: Synth): void {
    transport.onTick((step, time) => {
      if (!this.enabled) return;
      const idx = step % Math.max(1, this.loopSteps);
      for (const n of this.notes) {
        if (n.startStep === idx) {
          synth.noteOn(n.pitch, n.velocity);
          this.held.add(n.pitch);
        }
        if ((n.startStep + n.length) % this.loopSteps === idx) {
          synth.noteOff(n.pitch);
          this.held.delete(n.pitch);
        }
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
