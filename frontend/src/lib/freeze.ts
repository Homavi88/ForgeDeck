import { arrangeIdForMix } from "./mix";
import type { TimelineClip } from "../types";

export type FrozenLane = {
  mixId: string;
  originals: TimelineClip[];
  audioFileId: string;
  startBar: number;
  lengthBars: number;
};

export function laneIsFrozen(
  mixId: string,
  frozenLanes: Record<string, FrozenLane>,
  clips: TimelineClip[],
): boolean {
  if (frozenLanes[mixId]) return true;
  const trackId = arrangeIdForMix(mixId);
  return clips.some((c) => c.trackId === trackId && c.frozen);
}

export function applyFreeze(
  clips: TimelineClip[],
  mixId: string,
  frozen: TimelineClip,
): { clips: TimelineClip[]; originals: TimelineClip[] } {
  const trackId = arrangeIdForMix(mixId);
  const originals = clips.filter((c) => c.trackId === trackId);
  const next = clips.filter((c) => c.trackId !== trackId);
  next.push(frozen);
  return { clips: next, originals };
}

export function applyUnfreeze(clips: TimelineClip[], mixId: string, originals: TimelineClip[]): TimelineClip[] {
  const trackId = arrangeIdForMix(mixId);
  return [...clips.filter((c) => c.trackId !== trackId), ...originals];
}
