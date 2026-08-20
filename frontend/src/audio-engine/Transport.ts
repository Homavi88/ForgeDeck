/**
 * Lookahead scheduler (Chris Wilson pattern).
 * Uses AudioContext.currentTime as the audio clock; setTimeout is only for
 * waking the JS thread, never for sample-accurate timing.
 */
export type TickHandler = (step: number, time: number) => void;

export class Transport {
  ctx: AudioContext;
  bpm = 120;
  playing = false;
  lookAhead = 0.025;
  scheduleAhead = 0.12;
  stepsPerBar = 16;
  currentStep = 0;
  metronome = false;
  private nextNoteTime = 0;
  private timer: number | null = null;
  private listeners = new Set<TickHandler>();
  private click: OscillatorNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  get secondsPerStep(): number {
    // 16th notes at current BPM.
    return 60 / this.bpm / 4;
  }

  onTick(fn: TickHandler): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop(): void {
    this.playing = false;
    if (this.timer != null) window.clearTimeout(this.timer);
    this.timer = null;
    this.currentStep = 0;
  }

  toggle(): void {
    if (this.playing) this.stop();
    else this.start();
  }

  private scheduler = (): void => {
    if (!this.playing) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      const step = this.currentStep;
      const time = this.nextNoteTime;
      if (this.metronome && step % 4 === 0) this.playClick(time, step % 16 === 0);
      this.listeners.forEach((fn) => fn(step, time));
      this.nextNoteTime += this.secondsPerStep;
      this.currentStep += 1;
    }
    this.timer = window.setTimeout(this.scheduler, this.lookAhead * 1000);
  };

  private playClick(time: number, downbeat: boolean): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = downbeat ? 1200 : 800;
    g.gain.setValueAtTime(0.15, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
    this.click = osc;
  }
}
