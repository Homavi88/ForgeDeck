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
  loopOn = false;
  loopStartStep = 0;
  loopEndStep = 16 * 8;
  countInSteps = 0;
  tempoMap: Array<{ bar: number; bpm: number }> = [];
  midiClock: MIDIOutput | null = null;
  /** Headphones cue bus; used when `clickCueOnly` so the click is not on the master. */
  clickDest: AudioNode | null = null;
  clickCueOnly = false;
  private nextNoteTime = 0;
  private timer: number | null = null;
  private listeners = new Set<TickHandler>();
  private click: OscillatorNode | null = null;
  private clockAcc = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  get secondsPerStep(): number {
    return 60 / this.bpmAtStep(this.currentStep) / 4;
  }

  bpmAtStep(step: number): number {
    const bar = step / 16;
    let bpm = this.bpm;
    for (const p of this.tempoMap) {
      if (p.bar <= bar && p.bpm > 20) bpm = p.bpm;
    }
    return bpm > 20 ? bpm : 120;
  }

  onTick(fn: TickHandler): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.currentStep = this.countInSteps > 0 ? -this.countInSteps : 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.clockAcc = 0;
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
      const counting = step < 0;
      if ((this.metronome || counting) && ((step % 4) + 4) % 4 === 0) {
        this.playClick(time, ((step % 16) + 16) % 16 === 0);
      }
      if (!counting) this.listeners.forEach((fn) => fn(step, time));
      this.sendClock(time);
      this.nextNoteTime += this.secondsPerStep;
      this.currentStep += 1;
      if (this.loopOn && !counting && this.loopEndStep > this.loopStartStep && this.currentStep >= this.loopEndStep) {
        this.currentStep = this.loopStartStep;
      }
    }
    this.timer = window.setTimeout(this.scheduler, this.lookAhead * 1000);
  };

  private playClick(time: number, downbeat: boolean): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = downbeat ? 1200 : 800;
    g.gain.setValueAtTime(0.15, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    const dest = this.clickCueOnly && this.clickDest ? this.clickDest : this.ctx.destination;
    osc.connect(g).connect(dest);
    osc.start(time);
    osc.stop(time + 0.06);
    this.click = osc;
  }

  private sendClock(_time: number): void {
    const out = this.midiClock;
    if (!out) return;
    for (let i = 0; i < 6; i++) {
      try {
        out.send([0xf8]);
      } catch {
        /* port closed */
      }
    }
  }
}
