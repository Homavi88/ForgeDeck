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
    return;
  }
  if (parsed.kind === "pan") {
    const p = Math.max(-1, Math.min(1, value));
    if (timed) ch.panner.pan.setValueAtTime(p, when);
    else ch.setPan(p);
    return;
  }
  if (parsed.kind === "sendRev") {
    const v = Math.max(0, Math.min(1, value));
    if (timed) ch.sendRev.gain.setValueAtTime(v, when);
    else ch.setSendRev(v);
    return;
  }
  if (parsed.kind === "sendDly") {
    const v = Math.max(0, Math.min(1, value));
    if (timed) ch.sendDly.gain.setValueAtTime(v, when);
    else ch.setSendDly(v);
    return;
  }
  if (parsed.kind === "delayWet") {
    const v = Math.max(0, Math.min(1, value));
    if (timed) ch.fx.delay.wet.gain.setValueAtTime(v, when);
    else ch.fx.delay.wet.gain.value = v;
    return;
  }
  if (parsed.kind === "reverbWet") {
    const v = Math.max(0, Math.min(1, value));
    if (timed) {
      ch.fx.reverb.wet.gain.setValueAtTime(v, when);
      ch.fx.reverb.tapeWet.gain.setValueAtTime(v * 0.22, when);
    } else {
      ch.fx.reverb.setWet(v);
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
    return;
  }
  if (kind === "pan") {
    ch.panner.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, value)), when);
    return;
  }
  if (kind === "sendRev") {
    ch.sendRev.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, value)), when);
    return;
  }
  if (kind === "sendDly") {
    ch.sendDly.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, value)), when);
    return;
  }
  if (kind === "delayWet") {
    ch.fx.delay.wet.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, value)), when);
    return;
  }
  if (kind === "reverbWet") {
    const v = Math.max(0, Math.min(1, value));
    ch.fx.reverb.wet.gain.linearRampToValueAtTime(v, when);
    ch.fx.reverb.tapeWet.gain.linearRampToValueAtTime(v * 0.22, when);
  }
}
