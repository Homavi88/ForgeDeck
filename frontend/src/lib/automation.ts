import type { MixLane } from "../types";
import { snapBar } from "./clipEdit";
import { sessionLanes } from "./mix";

export type AutoKind =
  | "volume"
  | "filter"
  | "eqLow"
  | "pan"
  | "sendRev"
  | "sendDly"
  | "delayWet"
  | "reverbWet";

export type AutoPoint = { time: number; value: number };

export type AutoTargetInfo = { id: string; mixId: string; kind: AutoKind };

const KIND_SUFFIX: Record<AutoKind, string> = {
  volume: "volume",
  filter: "filter",
  eqLow: "eq.low",
  pan: "pan",
  sendRev: "send.rev",
  sendDly: "send.dly",
  delayWet: "fx.delay.wet",
  reverbWet: "fx.reverb.wet",
};

function kindFromSuffix(raw: string): AutoKind | null {
  if (raw === "volume") return "volume";
  if (raw === "filter" || raw === "filter.cutoff") return "filter";
  if (raw === "eq.low") return "eqLow";
  if (raw === "pan") return "pan";
  if (raw === "send.rev") return "sendRev";
  if (raw === "send.dly") return "sendDly";
  if (raw === "fx.delay.wet") return "delayWet";
  if (raw === "fx.reverb.wet") return "reverbWet";
  return null;
}

/** AI / graph ids: deck_a.* stay stable; extra lanes use `{mixId}.volume`. */
export function autoTargetId(mixId: string, kind: AutoKind): string {
  if (mixId === "A") {
    if (kind === "volume") return "deck_a.volume";
    if (kind === "filter") return "deck_a.filter.cutoff";
    if (kind === "eqLow") return "deck_a.eq.low";
    if (kind === "pan") return "deck_a.pan";
    if (kind === "sendRev") return "deck_a.send.rev";
    if (kind === "sendDly") return "deck_a.send.dly";
    if (kind === "delayWet") return "deck_a.fx.delay.wet";
    return "deck_a.fx.reverb.wet";
  }
  if (mixId === "B") {
    if (kind === "volume") return "deck_b.volume";
    if (kind === "filter") return "deck_b.filter.cutoff";
    if (kind === "eqLow") return "deck_b.eq.low";
    if (kind === "pan") return "deck_b.pan";
    if (kind === "sendRev") return "deck_b.send.rev";
    if (kind === "sendDly") return "deck_b.send.dly";
    if (kind === "delayWet") return "deck_b.fx.delay.wet";
    return "deck_b.fx.reverb.wet";
  }
  if (mixId === "master") {
    if (kind === "filter") return "master.filter";
    if (kind === "eqLow") return "master.eq.low";
    if (kind === "pan") return "master.pan";
    if (kind === "delayWet") return "master.fx.delay.wet";
    if (kind === "reverbWet") return "master.fx.reverb.wet";
    return "master.volume";
  }
  if (kind === "filter") return `${mixId}.filter`;
  return `${mixId}.${KIND_SUFFIX[kind]}`;
}

export function parseAutoTarget(target: string): AutoTargetInfo | null {
  const t = target.trim();
  if (!t) return null;
  if (t === "master.volume") return { id: t, mixId: "master", kind: "volume" };
  if (t === "master.filter") return { id: t, mixId: "master", kind: "filter" };
  if (t === "master.eq.low") return { id: t, mixId: "master", kind: "eqLow" };
  if (t === "master.pan") return { id: t, mixId: "master", kind: "pan" };
  if (t === "master.fx.delay.wet") return { id: t, mixId: "master", kind: "delayWet" };
  if (t === "master.fx.reverb.wet") return { id: t, mixId: "master", kind: "reverbWet" };
  const deck = /^deck_([ab])\.(volume|filter\.cutoff|eq\.low|pan|send\.rev|send\.dly|fx\.delay\.wet|fx\.reverb\.wet)$/.exec(t);
  if (deck) {
    const mixId = deck[1] === "a" ? "A" : "B";
    const kind = kindFromSuffix(deck[2]);
    if (!kind) return null;
    return { id: t, mixId, kind };
  }
  const m = /^(.+)\.(volume|filter|eq\.low|pan|send\.rev|send\.dly|fx\.delay\.wet|fx\.reverb\.wet)$/.exec(t);
  if (!m) return null;
  const kind = kindFromSuffix(m[2]);
  if (!kind) return null;
  return { id: t, mixId: m[1], kind };
}

export function autoTargetOptions(prodLanes: MixLane[]): AutoTargetInfo[] {
  const lanes = [...sessionLanes(prodLanes), { id: "master", name: "Master", color: "#e4e4e7", role: "audio" as const }];
  const kinds: AutoKind[] = ["volume", "filter", "eqLow", "pan", "sendRev", "sendDly", "delayWet", "reverbWet"];
  const out: AutoTargetInfo[] = [];
  for (const lane of lanes) {
    for (const kind of kinds) {
      if (lane.id === "master" && (kind === "sendRev" || kind === "sendDly")) continue;
      out.push({ id: autoTargetId(lane.id, kind), mixId: lane.id, kind });
    }
  }
  return out;
}

/** Volume/filter/sends/pan/wet store 0–1; EQ low stores dB (AI: 0 → −12). Pan unit 0–1 maps −1…1. */
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
