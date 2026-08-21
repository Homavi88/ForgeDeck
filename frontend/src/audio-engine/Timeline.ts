import type { TimelineClip } from "../types";
import type { Transport } from "./Transport";

/**
 * Arrangement playback: maps clip start bars onto the transport clock.
 * Clip audio is scheduled when the playhead reaches the clip's start step
 * (fractional bars allowed — beat / 8th snap).
 */
export class TimelineEngine {
  clips: TimelineClip[] = [];
  bars = 32;
  private fired = new Set<string>();
  private playClip?: (clip: TimelineClip, when: number) => void;

  setHandler(fn: (clip: TimelineClip, when: number) => void): void {
    this.playClip = fn;
  }

  reset(): void {
    this.fired.clear();
  }

  attach(transport: Transport): void {
    transport.onTick((step, time) => {
      if (step === 0) this.fired.clear();
      for (const clip of this.clips) {
        const startStep = Math.max(0, Math.round(clip.startBar * 16));
        if (step === startStep && !this.fired.has(clip.id)) {
          this.fired.add(clip.id);
          this.playClip?.(clip, time);
        }
      }
      const bar = Math.floor(step / 16);
      if (bar >= this.bars) this.fired.clear();
    });
  }

  splitClip(id: string, atBar: number): void {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip) return;
    if (atBar <= clip.startBar || atBar >= clip.startBar + clip.lengthBars) return;
    const leftLen = atBar - clip.startBar;
    const right: TimelineClip = {
      ...clip,
      id: crypto.randomUUID(),
      startBar: atBar,
      lengthBars: clip.lengthBars - leftLen,
    };
    clip.lengthBars = leftLen;
    this.clips.push(right);
  }
}
