export interface AutomationPoint {
  time: number;
  value: number;
}

/**
 * Linear automation writer. Values are applied on the audio thread via
 * AudioParam.setValueAtTime from the scheduler, not from rAF.
 */
export class AutomationEngine {
  lanes = new Map<string, AutomationPoint[]>();

  setLane(target: string, points: AutomationPoint[]): void {
    this.lanes.set(
      target,
      [...points].sort((a, b) => a.time - b.time),
    );
  }

  valueAt(target: string, time: number): number | null {
    const pts = this.lanes.get(target);
    if (!pts || pts.length === 0) return null;
    if (time <= pts[0].time) return pts[0].value;
    for (let i = 1; i < pts.length; i++) {
      if (time <= pts[i].time) {
        const a = pts[i - 1];
        const b = pts[i];
        const t = (time - a.time) / Math.max(0.0001, b.time - a.time);
        return a.value + (b.value - a.value) * t;
      }
    }
    return pts[pts.length - 1].value;
  }

  apply(target: string, time: number, write: (v: number) => void): void {
    const v = this.valueAt(target, time);
    if (v != null) write(v);
  }
}
