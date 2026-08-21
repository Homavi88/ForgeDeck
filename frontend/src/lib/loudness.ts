/** ITU-R BS.1770-4 K-weighting + gated loudness. Coefficients are for 48 kHz (bounce default). */

export type LoudnessReport = {
  lufs: number;
  truePeakDb: number;
  samplePeakDb: number;
};

function biquad(src: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const out = new Float32Array(src.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** Pre-filter + RLB at 48 kHz (BS.1770). Other rates are approximate. */
function kWeight(ch: Float32Array): Float32Array {
  const pre = biquad(ch, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585);
  return biquad(pre, 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
}

function meanSquare(a: Float32Array, start: number, end: number): number {
  let s = 0;
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i++) s += a[i] * a[i];
  return s / n;
}

function dbFs(peak: number): number {
  return 20 * Math.log10(Math.max(1e-12, peak));
}

function truePeak(ch: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > peak) peak = a;
    if (i + 1 >= ch.length) continue;
    const x0 = ch[i];
    const x1 = ch[i + 1];
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const y = Math.abs(x0 * (1 - t) + x1 * t);
      if (y > peak) peak = y;
    }
  }
  return peak;
}

export function measureLoudness(buffer: AudioBuffer): LoudnessReport {
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let samplePeak = 0;
  let tp = 0;
  const weighted = chans.map((ch) => {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > samplePeak) samplePeak = a;
    }
    tp = Math.max(tp, truePeak(ch));
    return kWeight(ch);
  });
  const sr = buffer.sampleRate || 48000;
  const hop = Math.max(1, Math.round(sr * 0.1));
  const win = Math.max(hop, Math.round(sr * 0.4));
  const blocks: number[] = [];
  const maxStart = Math.max(0, buffer.length - win);
  for (let start = 0; start <= maxStart; start += hop) {
    let ms = 0;
    for (const w of weighted) ms += meanSquare(w, start, start + win);
    ms /= weighted.length;
    const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, ms));
    blocks.push(lufs);
  }
  const absGated = blocks.filter((l) => l > -70);
  const absMean =
    absGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / Math.max(1, absGated.length);
  const relThresh = -0.691 + 10 * Math.log10(Math.max(1e-12, absMean)) - 10;
  const rel = (absGated.length ? absGated : blocks).filter((l) => l > relThresh);
  const mean = rel.reduce((s, l) => s + Math.pow(10, l / 10), 0) / Math.max(1, rel.length);
  const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, mean));
  return { lufs, truePeakDb: dbFs(tp), samplePeakDb: dbFs(samplePeak) };
}

export function scaleBuffer(buffer: AudioBuffer, gain: number): void {
  const g = Number.isFinite(gain) ? gain : 1;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
}

/** Shift integrated loudness toward target LUFS, then cap true peak at ceiling dBTP. */
export function normalizeLoudness(buffer: AudioBuffer, targetLufs = -14, ceilingDb = -1): LoudnessReport {
  const first = measureLoudness(buffer);
  const gainDb = targetLufs - first.lufs;
  scaleBuffer(buffer, Math.pow(10, gainDb / 20));
  const mid = measureLoudness(buffer);
  if (mid.truePeakDb > ceilingDb) {
    scaleBuffer(buffer, Math.pow(10, (ceilingDb - mid.truePeakDb) / 20));
  }
  return measureLoudness(buffer);
}
