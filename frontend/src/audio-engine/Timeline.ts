import type { TimelineClip } from "../types";
import type { Transport } from "./Transport";

/**
 * Arrangement playback: maps clip start bars onto the transport clock.
 * Clip audio is scheduled when the playhead enters the clip.
 */
export class TimelineEngine {
  clips: TimelineClip[] = [];
  bars = 32;
  private fired = new Set<string>();
  private playClip?: (clip: TimelineClip, when: number) => void;

  setHandler(fn: (clip: TimelineClip, when: number) => void): void {
    this.playClip = fn;
  }

  attach(transport: Transport): void {
    transport.onTick((step, time) => {
      const bar = Math.floor(step / 16);
      for (const clip of this.clips) {
        const key = `${clip.id}:${bar}`;
        if (bar === clip.startBar && !this.fired.has(key)) {
          this.fired.add(key);
          this.playClip?.(clip, time);
        }
      }
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
