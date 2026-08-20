/**
 * DJ deck: buffer playback with pitch, cue, hotcues, and looping.
 *
 * Independent time-stretch (key lock) is NOT implemented in MVP — changing
 * pitch also changes duration via playbackRate. Rubber Band / SoundTouch
 * WASM is the planned path (see TODO.md).
 */
export class Deck {
  ctx: AudioContext;
  output: GainNode;
  buffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  playing = false;
  pitch = 0; // percent, ±8 typical
  private startedAt = 0;
  private offset = 0;
  cuePoint = 0;
  loop: { start: number; end: number } | null = null;
  hotcues: Record<number, number> = {};
  onPosition?: (t: number) => void;
  private raf = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 1;
    this.output.connect(destination);
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get rate(): number {
    return 1 + this.pitch / 100;
  }

  get position(): number {
    if (!this.playing || !this.buffer) return this.offset;
    const elapsed = (this.ctx.currentTime - this.startedAt) * this.rate;
    let pos = this.offset + elapsed;
    if (this.loop && pos >= this.loop.end) {
      const span = this.loop.end - this.loop.start;
      pos = this.loop.start + ((pos - this.loop.start) % span);
    }
    return Math.min(pos, this.duration);
  }

  async loadBuffer(buffer: AudioBuffer): Promise<void> {
    const was = this.playing;
    this.stop();
    this.buffer = buffer;
    this.offset = 0;
    this.cuePoint = 0;
    if (was) this.play();
  }

  play(): void {
    if (!this.buffer || this.playing) return;
    this.spawn(this.offset);
    this.playing = true;
    this.watch();
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.position;
    this.killSource();
    this.playing = false;
  }

  stop(): void {
    this.killSource();
    this.playing = false;
    this.offset = 0;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(time: number): void {
    const t = Math.max(0, Math.min(time, this.duration));
    const was = this.playing;
    this.killSource();
    this.offset = t;
    this.playing = false;
    if (was) this.play();
  }

  cuePress(): void {
    if (this.playing) {
      this.pause();
      this.seek(this.cuePoint);
    } else {
      this.seek(this.cuePoint);
      this.play();
    }
  }

  setCueHere(): void {
    this.cuePoint = this.position;
  }

  setHotcue(index: number): void {
    this.hotcues[index] = this.position;
  }

  jumpHotcue(index: number): void {
    if (this.hotcues[index] == null) {
      this.setHotcue(index);
      return;
    }
    this.seek(this.hotcues[index]);
    if (!this.playing) this.play();
  }

  setPitch(percent: number): void {
    this.pitch = percent;
    if (this.source) this.source.playbackRate.value = this.rate;
  }

  syncToBpm(trackBpm: number, masterBpm: number): void {
    if (!trackBpm) return;
    const percent = (masterBpm / trackBpm - 1) * 100;
    this.setPitch(percent);
  }

  setLoop(start: number, end: number): void {
    this.loop = { start, end };
    if (this.source) {
      this.source.loop = true;
      this.source.loopStart = start;
      this.source.loopEnd = end;
    }
  }

  loopBars(bars: number, bpm: number): void {
    const barLen = (60 / bpm) * 4;
    const start = this.position;
    this.setLoop(start, start + barLen * bars);
  }

  clearLoop(): void {
    this.loop = null;
    if (this.source) this.source.loop = false;
  }

  private spawn(offset: number): void {
    if (!this.buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    if (this.loop) {
      src.loop = true;
      src.loopStart = this.loop.start;
      src.loopEnd = this.loop.end;
    }
    src.connect(this.output);
    src.start(0, offset);
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.offset = offset;
    src.onended = () => {
      if (this.source === src) {
        this.playing = false;
        this.offset = this.duration;
      }
    };
  }

  private killSource(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source?.disconnect();
    this.source = null;
  }

  private watch = (): void => {
    if (!this.playing) return;
    this.onPosition?.(this.position);
    this.raf = requestAnimationFrame(this.watch);
  };
}
