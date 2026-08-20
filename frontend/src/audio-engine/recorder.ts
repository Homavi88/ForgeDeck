/**
 * Live capture of the master bus into a WAV (what you hear during the set).
 * ScriptProcessor is deprecated but needs no extra worklet file and stays in-graph.
 */
export class LiveRecorder {
  private proc: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private left: Float32Array[] = [];
  private right: Float32Array[] = [];
  private sampleRate = 44100;
  private peak = 0;
  recording = false;

  get stats(): { elapsed: number; peak: number; bytes: number } {
    const samples = this.left.reduce((n, c) => n + c.length, 0);
    return {
      elapsed: this.sampleRate ? samples / this.sampleRate : 0,
      peak: this.peak,
      bytes: samples * 2 * 2,
    };
  }

  start(ctx: AudioContext, source: AudioNode): void {
    this.stop();
    this.recording = true;
    this.left = [];
    this.right = [];
    this.peak = 0;
    this.sampleRate = ctx.sampleRate;
    const proc = ctx.createScriptProcessor(4096, 2, 2);
    proc.onaudioprocess = (ev) => {
      if (!this.recording) return;
      const l = ev.inputBuffer.getChannelData(0);
      const r = ev.inputBuffer.numberOfChannels > 1 ? ev.inputBuffer.getChannelData(1) : l;
      this.left.push(new Float32Array(l));
      this.right.push(new Float32Array(r));
      let p = 0;
      for (let i = 0; i < l.length; i++) {
        const a = Math.abs(l[i]);
        const b = Math.abs(r[i]);
        if (a > p) p = a;
        if (b > p) p = b;
      }
      if (p > this.peak) this.peak = p;
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    this.proc = proc;
    this.mute = mute;
  }

  stop(): AudioBuffer | null {
    this.recording = false;
    try {
      this.proc?.disconnect();
      this.mute?.disconnect();
    } catch {
      /* ignore */
    }
    this.proc = null;
    this.mute = null;
    if (!this.left.length) return null;
    const length = this.left.reduce((n, c) => n + c.length, 0);
    const ctx = new OfflineAudioContext(2, length, this.sampleRate);
    const buffer = ctx.createBuffer(2, length, this.sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    let o = 0;
    for (let i = 0; i < this.left.length; i++) {
      L.set(this.left[i], o);
      R.set(this.right[i], o);
      o += this.left[i].length;
    }
    this.left = [];
    this.right = [];
    return buffer;
  }
}
