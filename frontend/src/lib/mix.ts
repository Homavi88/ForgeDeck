import type { MixLane, SessionClip } from "../types";

export const CORE_MIX_IDS = ["A", "B", "drums", "synth"] as const;

export const CORE_LANES: MixLane[] = [
  { id: "drums", name: "Drums", color: "#ff6a00", role: "drums" },
  { id: "synth", name: "Synth", color: "#3dfff3", role: "synth" },
  { id: "A", name: "Deck A", color: "#3dff7a", role: "deck" },
  { id: "B", name: "Deck B", color: "#ffd23f", role: "deck" },
];

export const AUDIO_LANE_COLORS = ["#7aa2ff", "#ff6ad5", "#c8ff3d", "#ff9a3d", "#b07cff", "#3dffc5"];

export const INSERT_DEVICES = [
  { kind: "eq", label: "EQ3" },
  { kind: "filter", label: "Filter" },
  { kind: "compressor", label: "Comp" },
  { kind: "distortion", label: "Drive" },
  { kind: "bitcrush", label: "Crush" },
  { kind: "flanger", label: "Flange" },
  { kind: "delay", label: "Delay" },
  { kind: "reverb", label: "Reverb" },
] as const;

export type InsertKind = (typeof INSERT_DEVICES)[number]["kind"];

export const FX_INSERT_KINDS = ["compressor", "distortion", "bitcrush", "flanger", "delay", "reverb"] as const;

export type FxInsertKind = (typeof FX_INSERT_KINDS)[number];

export const DEFAULT_INSERT_ORDER: InsertKind[] = INSERT_DEVICES.map((d) => d.kind);

const INSERT_KIND_SET = new Set<string>(DEFAULT_INSERT_ORDER);

export function isFxInsertKind(kind: string): kind is FxInsertKind {
  return (FX_INSERT_KINDS as readonly string[]).includes(kind);
}

/** Every device once; unknown ids dropped; missing kinds appended in the stock order. */
export function normalizeInsertOrder(order?: readonly string[] | null): InsertKind[] {
  const seen = new Set<InsertKind>();
  const out: InsertKind[] = [];
  for (const raw of order || []) {
    if (!INSERT_KIND_SET.has(raw) || seen.has(raw as InsertKind)) continue;
    const kind = raw as InsertKind;
    seen.add(kind);
    out.push(kind);
  }
  for (const kind of DEFAULT_INSERT_ORDER) {
    if (!seen.has(kind)) out.push(kind);
  }
  return out;
}

export function moveInsertOrder(order: readonly string[] | undefined, kind: InsertKind, dir: -1 | 1): InsertKind[] {
  const cur = normalizeInsertOrder(order);
  const i = cur.indexOf(kind);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.length) return cur;
  const next = [...cur];
  const swap = next[i];
  next[i] = next[j];
  next[j] = swap;
  return next;
}

export function reorderInsert(order: readonly string[] | undefined, kind: InsertKind, toIndex: number): InsertKind[] {
  const cur = normalizeInsertOrder(order);
  const from = cur.indexOf(kind);
  if (from < 0) return cur;
  const next = [...cur];
  next.splice(from, 1);
  const clamped = Math.max(0, Math.min(next.length, toIndex));
  next.splice(clamped, 0, kind);
  return normalizeInsertOrder(next);
}

export function isCoreMixId(id: string): boolean {
  return (CORE_MIX_IDS as readonly string[]).includes(id);
}

/** Arrange clip.trackId → mixer channel id. */
export function mixerIdForTrack(trackId: string): string {
  if (trackId === "deckA") return "A";
  if (trackId === "deckB") return "B";
  return trackId;
}

/** Mixer channel id → Arrange clip.trackId. */
export function arrangeIdForMix(id: string): string {
  if (id === "A") return "deckA";
  if (id === "B") return "deckB";
  return id;
}

export function laneColor(id: string, extra: MixLane[] = []): string {
  const hit = [...CORE_LANES, ...extra].find((l) => l.id === id || arrangeIdForMix(l.id) === id);
  return hit?.color || "#7aa2ff";
}

export const SESSION_SCENES = 8;

const SESSION_SCENE_NAMES = ["Intro", "Groove", "Drop", "Break", "Drop 2", "Fill", "Outro", "Loop"];

export function sessionLanes(prodLanes: MixLane[]): MixLane[] {
  return [...CORE_LANES, ...prodLanes];
}

export function emptySessionSlot(trackId: string, scene: number, color: string): SessionClip {
  const kind: SessionClip["kind"] = trackId === "drums" ? "drums" : trackId === "synth" ? "midi" : "audio";
  return {
    id: `${trackId}-${scene}`,
    trackId,
    scene,
    name: SESSION_SCENE_NAMES[scene] || `Scene ${scene + 1}`,
    kind,
    lengthBars: scene % 2 === 0 ? 8 : 4,
    color,
    empty: true,
  };
}

/** Keep Session slots in lockstep with Arrange/mixer lanes (8 scenes × each track). */
export function ensureSessionClips(clips: SessionClip[], prodLanes: MixLane[]): SessionClip[] {
  const lanes = sessionLanes(prodLanes);
  const trackIds = new Set(lanes.map((l) => arrangeIdForMix(l.id)));
  const out = clips.filter((c) => trackIds.has(c.trackId));
  for (const lane of lanes) {
    const trackId = arrangeIdForMix(lane.id);
    for (let scene = 0; scene < SESSION_SCENES; scene++) {
      if (!out.some((c) => c.trackId === trackId && c.scene === scene)) {
        out.push(emptySessionSlot(trackId, scene, lane.color));
      }
    }
  }
  return out;
}
