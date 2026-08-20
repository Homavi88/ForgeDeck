/**
 * Analog-model curves and convolution IRs shared by the live mixer and bounce.
 * IRs are seeded so offline renders are deterministic.
 */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** Tape tanh + transformer even harmonics + diode asymmetry. */
export function analogDriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 44100;
  const samples = new Float32Array(new ArrayBuffer(n * 4));
  const drive = 0.2 + Math.max(0, amount) * 14;
  const even = 0.14 * Math.max(0, amount);
  const asym = 0.1 * Math.max(0, amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    let y = Math.tanh(drive * x);
    y += even * x * x * Math.sign(x || 1);
    if (x >= 0) y *= 1 + asym;
    else y *= 1 - asym * 0.55;
    samples[i] = Math.max(-1, Math.min(1, y * 0.9));
  }
  return samples;
}

export function bitcrushCurve(bits = 3): Float32Array<ArrayBuffer> {
  const n = 256;
  const steps = Math.pow(2, Math.max(1, bits) - 1);
  const samples = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = i / (n / 2) - 1;
    samples[i] = Math.round(x * steps) / steps;
  }
  return samples;
}

function fillStereoIR(
  ctx: BaseAudioContext,
  seconds: number,
  seed: number,
  write: (data: Float32Array, ch: number, rand: () => number, sr: number) => void,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sr * seconds));
  const ir = ctx.createBuffer(2, length, sr);
  for (let ch = 0; ch < 2; ch++) {
    write(ir.getChannelData(ch), ch, rng(seed + ch * 9973), sr);
  }
  return ir;
}

/** Dense plate: filtered noise with exponential decay, stereo decorrelated. */
export function analogPlateIR(ctx: BaseAudioContext, seconds = 1.85, decay = 2.35): AudioBuffer {
  return fillStereoIR(ctx, seconds, 0x504c41, (data, ch, rand, sr) => {
    let lp = 0;
    const delay = ch === 0 ? 0 : Math.floor(0.012 * sr);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, decay);
      const noise = rand() * 2 - 1;
      lp = 0.72 * lp + 0.28 * noise;
      const j = i + delay;
      if (j < data.length) data[j] += lp * env * 0.85;
    }
  });
}

/** Spring: dispersive modal bursts (cheap physical-model IR). */
export function analogSpringIR(ctx: BaseAudioContext, seconds = 0.95): AudioBuffer {
  return fillStereoIR(ctx, seconds, 0x535052, (data, _ch, rand, sr) => {
    const modes = [186, 312, 447, 690, 1020, 1540];
    for (let m = 0; m < modes.length; m++) {
      const f = modes[m] * (1 + (rand() - 0.5) * 0.03);
      const phase = rand() * Math.PI * 2;
      const damp = 4.5 + m * 1.4;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = Math.exp(-damp * t) * (0.35 / (m + 1));
        data[i] += Math.sin(2 * Math.PI * f * t + phase) * env;
      }
    }
    const chirpN = Math.min(data.length, Math.floor(sr * 0.08));
    for (let i = 0; i < chirpN; i++) {
      const t = i / sr;
      data[i] += Math.sin(2 * Math.PI * (120 + 2800 * t) * t) * Math.exp(-18 * t) * 0.2;
    }
  });
}

/** Short guitar-cab / console transformer IR for analog distortion. */
export function analogCabinetIR(ctx: BaseAudioContext): AudioBuffer {
  return fillStereoIR(ctx, 0.018, 0x434142, (data, _ch, rand, sr) => {
    let bp = 0;
    let lp = 0;
    for (let i = 0; i < data.length; i++) {
      const env = Math.exp((-i / sr) * 90);
      const noise = rand() * 2 - 1;
      lp = 0.55 * lp + 0.45 * noise;
      bp = 0.7 * bp + 0.3 * (lp - bp);
      data[i] = bp * env;
    }
    // Resonant bump around 3–4 kHz like a cheap cab.
    const f = 3400;
    for (let i = 0; i < data.length; i++) {
      data[i] += Math.sin((2 * Math.PI * f * i) / sr) * Math.exp((-i / sr) * 220) * 0.15;
    }
  });
}

/** Discrete tape-echo taps with wow — used as extra convolution colour. */
export function analogTapeEchoIR(ctx: BaseAudioContext): AudioBuffer {
  return fillStereoIR(ctx, 0.9, 0x544150, (data, ch, rand, sr) => {
    const taps = [0.083, 0.171, 0.337, 0.509];
    for (const tap of taps) {
      const wow = 1 + (rand() - 0.5) * 0.012;
      const at = Math.min(data.length - 1, Math.floor(tap * wow * sr) + (ch === 1 ? 7 : 0));
      data[at] += 0.55 * Math.pow(0.62, taps.indexOf(tap));
    }
    for (let i = 1; i < data.length; i++) {
      data[i] += data[i - 1] * 0.12;
    }
  });
}

/** Default studio reverb: plate with a little spring splash. */
export function analogReverbIR(ctx: BaseAudioContext): AudioBuffer {
  const plate = analogPlateIR(ctx, 1.85, 2.3);
  const spring = analogSpringIR(ctx, 0.7);
  const n = Math.min(plate.length, spring.length);
  for (let ch = 0; ch < 2; ch++) {
    const a = plate.getChannelData(ch);
    const b = spring.getChannelData(ch);
    for (let i = 0; i < n; i++) a[i] = a[i] * 0.84 + b[i] * 0.16;
  }
  return plate;
}
