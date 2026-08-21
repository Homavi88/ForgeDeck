import type { Mixer } from "./Mixer";
import { Filter } from "./Filter";
import type { AutomationPoint } from "./AutomationEngine";
import { parseAutoTarget, type AutoKind } from "../lib/automation";

function channel(mixer: Mixer, mixId: string) {
  if (mixId === "master") return mixer.master;
  return mixer.channels[mixId] ?? null;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1.5, v));
}

/** Live: set current values. Offline: schedule AudioParam at `when`. */
export function writeAutomationValue(mixer: Mixer, target: string, value: number, when?: number): void {
  const parsed = parseAutoTarget(target);
  if (!parsed) return;
  const ch = channel(mixer, parsed.mixId);
  if (!ch) return;
  const timed = when != null && Number.isFinite(when);
  if (parsed.kind === "volume") {
    const v = clamp01(value);
    if (timed) ch.volume.gain.setValueAtTime(v, when);
    else ch.setVolume(v);
    return;
  }
  if (parsed.kind === "filter") {
    const knob = value * 2 - 1;
    if (timed) ch.filter.setKnob(knob, when);
    else ch.filter.setKnob(knob);
    return;
  }
  if (parsed.kind === "eqLow") {
    if (timed) {
      ch.eq.set(value, ch.eq.user[1], ch.eq.user[2]);
      ch.eq.low.gain.setValueAtTime(ch.eq.kills[0] ? -72 : value, when);
    } else {
      ch.eq.set(value, ch.eq.user[1], ch.eq.user[2]);
    }
  }
}

export function scheduleAutomationLanes(
  mixer: Mixer,
  lanes: Array<{ target: string; points: AutomationPoint[] }>,
  timeOffset = 0,
): void {
  const at = (time: number) => Math.max(0, time - timeOffset);
  for (const lane of lanes) {
    if (!lane.points.length) continue;
    const pts = [...lane.points].sort((a, b) => a.time - b.time);
    let initial = pts[0];
    for (const p of pts) {
      if (p.time <= timeOffset) initial = p;
      else break;
    }
    writeAutomationValue(mixer, lane.target, initial.value, 0);
    writeAutomationValue(mixer, lane.target, initial.value, at(initial.time));
    const parsed = parseAutoTarget(lane.target);
    const ch = parsed ? channel(mixer, parsed.mixId) : null;
    if (!ch || !parsed) continue;
    for (const p of pts) {
      if (p.time <= timeOffset && p !== initial) continue;
      if (p === initial) continue;
      rampKind(ch, parsed.kind, p.value, at(p.time));
    }
  }
}

function rampKind(
  ch: NonNullable<ReturnType<typeof channel>>,
  kind: AutoKind,
  value: number,
  when: number,
): void {
  if (kind === "volume") {
    ch.volume.gain.linearRampToValueAtTime(clamp01(value), when);
    return;
  }
  if (kind === "eqLow") {
    ch.eq.low.gain.linearRampToValueAtTime(ch.eq.kills[0] ? -72 : value, when);
    return;
  }
  if (kind === "filter") {
    const p = Filter.params(value * 2 - 1);
    ch.filter.node.type = p.type;
    ch.filter.node.frequency.linearRampToValueAtTime(p.freq, when);
    ch.filter.node.Q.linearRampToValueAtTime(p.q, when);
  }
}
