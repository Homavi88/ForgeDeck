/** Keys, scales and chord stamps — FL Piano Roll helpers (scale highlight / stamp). */

export const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export const KEY_OPTIONS: string[] = PC_NAMES.flatMap((n) => [`${n} minor`, `${n} major`]);

export type ScaleId =
  | "chromatic"
  | "diatonic"
  | "pentMin"
  | "pentMaj"
  | "blues"
  | "dorian"
  | "mixolydian"
  | "harmonicMinor";

export const SCALE_IDS: ScaleId[] = [
  "chromatic",
  "diatonic",
  "pentMin",
  "pentMaj",
  "blues",
  "dorian",
  "mixolydian",
  "harmonicMinor",
];

const INTERVALS: Record<Exclude<ScaleId, "chromatic" | "diatonic">, number[]> = {
  pentMin: [0, 3, 5, 7, 10],
  pentMaj: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

export type ChordStampId = "maj" | "min" | "7" | "maj7" | "min7" | "sus4" | "sus2" | "dim" | "aug" | "5" | "oct";

export const CHORD_STAMPS: { id: ChordStampId; intervals: number[] }[] = [
  { id: "maj", intervals: [0, 4, 7] },
  { id: "min", intervals: [0, 3, 7] },
  { id: "7", intervals: [0, 4, 7, 10] },
  { id: "maj7", intervals: [0, 4, 7, 11] },
  { id: "min7", intervals: [0, 3, 7, 10] },
  { id: "sus4", intervals: [0, 5, 7] },
  { id: "sus2", intervals: [0, 2, 7] },
  { id: "dim", intervals: [0, 3, 6] },
  { id: "aug", intervals: [0, 4, 8] },
  { id: "5", intervals: [0, 7] },
  { id: "oct", intervals: [0, 12] },
];

export function parseKey(key: string): { tonic: number; minor: boolean } {
  const raw = (key || "C minor").trim();
  const token = (raw.split(/\s+/)[0] || "C")
    .replace("Db", "C#")
    .replace("Eb", "D#")
    .replace("Gb", "F#")
    .replace("Ab", "G#")
    .replace("Bb", "A#");
  const idx = PC_NAMES.indexOf(token as (typeof PC_NAMES)[number]);
  const tonic = idx < 0 ? 0 : idx;
  const lower = raw.toLowerCase();
  const minor = /\bmin/.test(lower) || (!/\bmaj/.test(lower) && lower.includes("minor"));
  return { tonic, minor };
}

export function scalePitchClasses(key: string, scale: ScaleId): number[] | null {
  if (scale === "chromatic") return null;
  const { tonic, minor } = parseKey(key);
  let intervals: number[];
  if (scale === "diatonic") intervals = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  else intervals = INTERVALS[scale];
  return intervals.map((i) => (tonic + i) % 12);
}

export function inScale(pitch: number, pcs: number[] | null): boolean {
  if (!pcs) return true;
  return pcs.includes(((pitch % 12) + 12) % 12);
}

export function midiName(pitch: number): string {
  const p = Math.round(pitch);
  return `${PC_NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`;
}

export function isBlackKey(pitch: number): boolean {
  return BLACK_PCS.has(((pitch % 12) + 12) % 12);
}
