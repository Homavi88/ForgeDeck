/**
 * DJ deck: buffer playback with pitch, cue, hotcues, looping, beat jump, slip.
 *
 * Key lock uses overlapping grains at playbackRate=1 while the read head
 * walks the buffer at `rate`. This is WSOLA-ish, not Rubber Band — pitch
 * stays close, transients smear a bit. Toggle off for classic vinyl pitch.
 */
export class Deck {
  ctx: AudioContext;
  output: GainNode;
  buffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  playing = false;
  pitch = 0;
  keyLock = false;
  slip = false;
  quantize = true;
  beats: number[] = [];
  private startedAt = 0;
  private offset = 0;
  private slipOrigin = 0;
  cuePoint = 0;
  loop: { start: number; end: number } | null = null;
  private loopInMark: number | null = null;
  hotcues: Record<number, number> = {};
  onPosition?: (t: number) => void;
  private raf = 0;
  private grainTimer: number | null = null;
  private grainPos = 0;
  private grains: AudioBufferSourceNode[] = [];

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
    if (this.keyLock) {
      let pos = this.grainPos;
      if (this.loop && pos >= this.loop.end) {
        const span = Math.max(0.01, this.loop.end - this.loop.start);
        pos = this.loop.start + ((pos - this.loop.start) % span);
      }
      return Math.min(pos, this.duration);
    }
    const elapsed = (this.ctx.currentTime - this.startedAt) * this.rate;
    let pos = this.offset + elapsed;
    if (this.loop && !this.slip && pos >= this.loop.end) {
      const span = this.loop.end - this.loop.start;
      pos = this.loop.start + ((pos - this.loop.start) % span);
    }
    return Math.min(pos, this.duration);
  }

  async loadBuffer(buffer: AudioBuffer, beats: number[] = []): Promise<void> {
    const was = this.playing;
    this.stop();
    this.buffer = buffer;
    this.beats = beats;
    this.offset = 0;
    this.cuePoint = 0;
    if (was) this.play();
  }

  play(): void {
    if (!this.buffer || this.playing) return;
    this.playing = true;
    this.slipOrigin = this.offset;
    if (this.keyLock) this.spawnGrains(this.offset);
    else this.spawn(this.offset);
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
    const t = Math.max(0, Math.min(this.snap(time), this.duration));
    const was = this.playing;
    this.killSource();
    this.offset = t;
    this.playing = false;
    if (was) this.play();
  }

  snap(time: number): number {
    if (!this.quantize || this.beats.length < 2) return time;
    let best = this.beats[0];
    let dist = Math.abs(time - best);
    for (const b of this.beats) {
      const d = Math.abs(time - b);
      if (d < dist) {
        dist = d;
        best = b;
      }
    }
    return dist < 0.12 ? best : time;
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
    this.cuePoint = this.snap(this.position);
  }

  setHotcue(index: number): void {
    this.hotcues[index] = this.snap(this.position);
  }

  jumpHotcue(index: number): void {
    if (this.hotcues[index] == null) {
      this.setHotcue(index);
      return;
    }
    this.seek(this.hotcues[index]);
    if (!this.playing) this.play();
  }

  beatJump(beats: number, bpm: number): void {
    const dt = (60 / Math.max(bpm, 1)) * beats;
    this.seek(this.position + dt);
  }

  markLoopIn(): void {
    this.loopInMark = this.position;
  }

  markLoopOut(): void {
    const start = this.loopInMark ?? this.cuePoint;
    const end = Math.max(start + 0.05, this.position);
    this.setLoop(start, end);
  }

  setPitch(percent: number): void {
    this.pitch = percent;
    if (this.source && !this.keyLock) this.source.playbackRate.value = this.rate;
  }

  setKeyLock(on: boolean): void {
    const was = this.playing;
    const pos = this.position;
    this.keyLock = on;
    if (was) {
      this.killSource();
      this.playing = false;
      this.offset = pos;
      this.play();
    }
  }

  syncToBpm(trackBpm: number, masterBpm: number): void {
    if (!trackBpm) return;
    this.setPitch((masterBpm / trackBpm - 1) * 100);
  }

  setLoop(start: number, end: number): void {
    this.loop = { start, end };
    if (this.source && !this.keyLock) {
      this.source.loop = true;
      this.source.loopStart = start;
      this.source.loopEnd = end;
    }
  }

  loopBars(bars: number, bpm: number): void {
    const barLen = (60 / bpm) * 4;
    const start = this.snap(this.position);
    this.setLoop(start, start + barLen * bars);
  }

  clearLoop(): void {
    this.loop = null;
    this.loopInMark = null;
    if (this.source) this.source.loop = false;
  }

  /** Vinyl scratch: jog the playhead by seconds (from platter drag). */
  scratch(deltaSeconds: number): void {
    this.seek(this.position + deltaSeconds);
    if (!this.playing && this.buffer) this.play();
  }

  setVinylRate(multiplier: number): void {
    if (this.source && !this.keyLock) this.source.playbackRate.value = this.rate * multiplier;
  }

  private savedLoop: { start: number; end: number } | null = null;

  loopRollStart(beats: number, bpm: number): void {
    this.savedLoop = this.loop;
    const len = (60 / Math.max(bpm, 1)) * beats;
    const start = this.position;
    this.setLoop(start, start + Math.max(0.05, len));
    if (!this.playing) this.play();
  }

  loopRollEnd(): void {
    if (this.savedLoop) this.setLoop(this.savedLoop.start, this.savedLoop.end);
    else this.clearLoop();
    this.savedLoop = null;
  }

  private spawn(offset: number): void {
    if (!this.buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    if (this.loop && !this.slip) {
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

  private spawnGrains(offset: number): void {
    this.grainPos = offset;
    this.offset = offset;
    this.startedAt = this.ctx.currentTime;
    this.scheduleGrain();
  }

  private scheduleGrain = (): void => {
    if (!this.playing || !this.buffer || !this.keyLock) return;
    const grain = 0.09;
    const hop = 0.045;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 1;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.012);
    g.gain.linearRampToValueAtTime(0.0001, t + grain);
    src.connect(g).connect(this.output);
    let start = this.grainPos;
    if (this.loop && start >= this.loop.end) {
      start = this.loop.start + ((start - this.loop.start) % Math.max(0.01, this.loop.end - this.loop.start));
      this.grainPos = start;
    }
    src.start(t, Math.max(0, start), grain);
    this.grains.push(src);
    if (this.grains.length > 8) {
      const old = this.grains.shift();
      try {
        old?.stop();
      } catch {
        /* ignore */
      }
    }
    this.grainPos += hop * this.rate;
    this.grainTimer = window.setTimeout(this.scheduleGrain, hop * 1000);
  };

  private killSource(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.grainTimer != null) window.clearTimeout(this.grainTimer);
    this.grainTimer = null;
    for (const g of this.grains) {
      try {
        g.stop();
      } catch {
        /* ignore */
      }
    }
    this.grains = [];
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
