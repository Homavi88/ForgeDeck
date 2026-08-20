/** Simple sampler: trim, reverse, pitch, one-shot / loop, pad assign. */
export class Sampler {
  ctx: AudioContext;
  output: GainNode;
  buffer: AudioBuffer | null = null;
  start = 0;
  end = 0;
  playbackRate = 1;
  reverse = false;
  loop = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.connect(destination);
  }

  load(buffer: AudioBuffer): void {
    this.buffer = buffer;
    this.start = 0;
    this.end = buffer.duration;
  }

  reversedBuffer(): AudioBuffer | null {
    if (!this.buffer) return null;
    if (!this.reverse) return this.buffer;
    const src = this.buffer;
    const dst = this.ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const a = src.getChannelData(ch);
      const b = dst.getChannelData(ch);
      for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i];
    }
    return dst;
  }

  trigger(velocity = 1): void {
    const buf = this.reversedBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = this.playbackRate;
    src.loop = this.loop;
    if (this.loop) {
      src.loopStart = this.start;
      src.loopEnd = this.end;
    }
    const g = this.ctx.createGain();
    g.gain.value = velocity;
    src.connect(g).connect(this.output);
    src.start(0, this.start, this.loop ? undefined : Math.max(0.01, this.end - this.start));
  }
}

/**
 * Transient slicing (placeholder): uses peak-energy windows.
 * Full onset slicing should use backend analysis.onsets.
 */
export function sliceByOnsets(buffer: AudioBuffer, onsets: number[]): AudioBuffer[] {
  const slices: AudioBuffer[] = [];
  const times = [...onsets, buffer.duration];
  for (let i = 0; i < times.length - 1; i++) {
    const start = Math.floor(times[i] * buffer.sampleRate);
    const end = Math.floor(times[i + 1] * buffer.sampleRate);
    const len = Math.max(1, end - start);
    const slice = new AudioBuffer({
      length: len,
      numberOfChannels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
    });
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      slice.copyToChannel(buffer.getChannelData(ch).slice(start, start + len), ch);
    }
    slices.push(slice);
  }
  return slices;
}
