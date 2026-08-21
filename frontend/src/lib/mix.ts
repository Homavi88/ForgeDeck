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
