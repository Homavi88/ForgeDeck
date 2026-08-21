import type { MixLane } from "../types";
import { snapBar } from "./clipEdit";
import { sessionLanes } from "./mix";

export type AutoKind = "volume" | "filter" | "eqLow" | "pan" | "sendRev" | "sendDly";

export type AutoPoint = { time: number; value: number };

export type AutoTargetInfo = { id: string; mixId: string; kind: AutoKind };

/** AI / graph ids: deck_a.* stay stable; extra lanes use `{mixId}.volume`. */
export function autoTargetId(mixId: string, kind: AutoKind): string {
  if (mixId === "A") {
    if (kind === "volume") return "deck_a.volume";
    if (kind === "filter") return "deck_a.filter.cutoff";
    if (kind === "eqLow") return "deck_a.eq.low";
    if (kind === "pan") return "deck_a.pan";
    if (kind === "sendRev") return "deck_a.send.rev";
    return "deck_a.send.dly";
  }
  if (mixId === "B") {
    if (kind === "volume") return "deck_b.volume";
    if (kind === "filter") return "deck_b.filter.cutoff";
    if (kind === "eqLow") return "deck_b.eq.low";
    if (kind === "pan") return "deck_b.pan";
    if (kind === "sendRev") return "deck_b.send.rev";
    return "deck_b.send.dly";
  }
  if (mixId === "master") {
    if (kind === "filter") return "master.filter";
    if (kind === "eqLow") return "master.eq.low";
    if (kind === "pan") return "master.pan";
    return "master.volume";
  }
  if (kind === "filter") return `${mixId}.filter`;
  if (kind === "eqLow") return `${mixId}.eq.low`;
  if (kind === "pan") return `${mixId}.pan`;
  if (kind === "sendRev") return `${mixId}.send.rev`;
  if (kind === "sendDly") return `${mixId}.send.dly`;
  return `${mixId}.volume`;
}

export function parseAutoTarget(target: string): AutoTargetInfo | null {
  const t = target.trim();
  if (!t) return null;
  if (t === "master.volume") return { id: t, mixId: "master", kind: "volume" };
  if (t === "master.filter") return { id: t, mixId: "master", kind: "filter" };
  if (t === "master.eq.low") return { id: t, mixId: "master", kind: "eqLow" };
  if (t === "master.pan") return { id: t, mixId: "master", kind: "pan" };
  const deck = /^deck_([ab])\.(volume|filter\.cutoff|eq\.low|pan|send\.rev|send\.dly)$/.exec(t);
  if (deck) {
    const mixId = deck[1] === "a" ? "A" : "B";
    const raw = deck[2];
    const kind: AutoKind =
      raw === "volume"
        ? "volume"
        : raw.startsWith("filter")
          ? "filter"
          : raw === "eq.low"
            ? "eqLow"
            : raw === "pan"
              ? "pan"
              : raw === "send.rev"
                ? "sendRev"
                : "sendDly";
    return { id: t, mixId, kind };
  }
  const m = /^(.+)\.(volume|filter|eq\.low|pan|send\.rev|send\.dly)$/.exec(t);
  if (!m) return null;
  const kind: AutoKind =
    m[2] === "volume"
      ? "volume"
      : m[2] === "filter"
        ? "filter"
        : m[2] === "eq.low"
          ? "eqLow"
          : m[2] === "pan"
            ? "pan"
            : m[2] === "send.rev"
              ? "sendRev"
              : "sendDly";
  return { id: t, mixId: m[1], kind };
}

export function autoTargetOptions(prodLanes: MixLane[]): AutoTargetInfo[] {
  const lanes = [...sessionLanes(prodLanes), { id: "master", name: "Master", color: "#e4e4e7", role: "audio" as const }];
  const kinds: AutoKind[] = ["volume", "filter", "eqLow", "pan", "sendRev", "sendDly"];
  const out: AutoTargetInfo[] = [];
  for (const lane of lanes) {
    for (const kind of kinds) out.push({ id: autoTargetId(lane.id, kind), mixId: lane.id, kind });
  }
  return out;
}

/** Volume/filter/sends/pan store 0–1; EQ low stores dB (AI: 0 → −12). Pan unit 0–1 maps −1…1. */
export function valueToUnit(kind: AutoKind, value: number): number {
  if (kind === "eqLow") return Math.max(0, Math.min(1, (value + 12) / 24));
  if (kind === "pan") return Math.max(0, Math.min(1, (value + 1) / 2));
  return Math.max(0, Math.min(1, value));
}

export function unitToValue(kind: AutoKind, unit: number): number {
  const u = Math.max(0, Math.min(1, unit));
  if (kind === "eqLow") return u * 24 - 12;
  if (kind === "pan") return u * 2 - 1;
  return u;
}

export function snapAutoTime(sec: number, snapBars: number, barSec: number): number {
  return snapBar(sec / Math.max(0.001, barSec), snapBars) * barSec;
}

export function upsertAutoPoint(points: AutoPoint[], time: number, value: number, mergeSec: number): AutoPoint[] {
  const t = Math.max(0, time);
  const next = points.filter((p) => Math.abs(p.time - t) > mergeSec);
  next.push({ time: t, value });
  next.sort((a, b) => a.time - b.time);
  return next;
}

export function removeAutoPointNear(points: AutoPoint[], time: number, mergeSec: number): AutoPoint[] {
  return points.filter((p) => Math.abs(p.time - time) > mergeSec);
}
