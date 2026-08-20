/** Camelot neighbors — same rules as backend `app.services.harmony.compatible_camelot`. */

export function compatibleCamelot(code: string): Set<string> {
  const raw = (code || "").trim().toUpperCase();
  if (raw.length < 2) return new Set(raw ? [raw] : []);
  const num = Number.parseInt(raw.replace(/\D/g, "") || "1", 10);
  const letter = raw.slice(-1);
  const other = letter === "A" ? "B" : "A";
  const n = Number.isFinite(num) ? Math.min(12, Math.max(1, num)) : 1;
  return new Set([
    `${n}${letter}`,
    `${n}${other}`,
    `${(n % 12) + 1}${letter}`,
    `${n === 1 ? 12 : n - 1}${letter}`,
  ]);
}

export function bpmCompatible(a: number, b: number, pct = 0.06): boolean {
  if (!a || !b) return false;
  return (
    Math.abs(a - b) / Math.max(a, b) <= pct ||
    Math.abs(a * 2 - b) / Math.max(a * 2, b) <= pct ||
    Math.abs(a - b * 2) / Math.max(a, b * 2) <= pct
  );
}

export function isMixCompatible(fromCamelot: string | undefined, fromBpm: number | undefined, toCamelot?: string, toBpm?: number): boolean {
  if (!fromCamelot || !toCamelot) return false;
  if (!compatibleCamelot(fromCamelot).has(toCamelot.toUpperCase())) return false;
  if (fromBpm && toBpm && !bpmCompatible(fromBpm, toBpm)) return false;
  return true;
}
