import { t } from "../i18n";
import { api } from "../api/client";
import { AutomationEngine } from "./AutomationEngine";
import { ClipLauncher } from "./ClipLauncher";
import { scheduleWarpedClip, type WarpedVoice } from "./clipPlayback";
import { Deck } from "./Deck";
import { DrumMachine } from "./DrumMachine";
import { Mixer } from "./Mixer";
import { applyMidiTarget, loadMidiBindings, lookupMidiTarget, persistMidiBindings, type MidiBindings } from "./midiMap";
import { PianoRoll } from "./PianoRoll";
import { LiveRecorder } from "./recorder";
import { Sampler } from "./Sampler";
import { Synth } from "./Synth";
import { TimelineEngine } from "./Timeline";
import { Transport } from "./Transport";
import { warmupRubberBand } from "./rubberband";
import { decodeUrl } from "./utils";
import { writeAutomationValue } from "./applyAutomation";
import { isCoreMixId, mixerIdForTrack } from "../lib/mix";
import type { MidiNote, SessionClip, TimelineClip } from "../types";

export class AudioEngine {
  ctx: AudioContext;
  transport: Transport;
  mixer: Mixer;
  decks: { A: Deck; B: Deck };
  drums: DrumMachine;
  synth: Synth;
  sampler: Sampler;
  timeline: TimelineEngine;
  automation: AutomationEngine;
  piano: PianoRoll;
  launcher: ClipLauncher;
  ready = false;
  arrangeMode = false;
  buffers = new Map<string, AudioBuffer>();
  midiBindings: MidiBindings = loadMidiBindings();
  recorder = new LiveRecorder();
  micGain: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  stemDecks: { A: Record<string, Deck>; B: Record<string, Deck> } = { A: {}, B: {} };
  stemsActive: { A: boolean; B: boolean } = { A: false, B: false };
  stemIso: { A: string | null; B: string | null } = { A: null, B: null };
  projectKey = "C minor";
  onSessionLaunch?: (trackId: string, clip: SessionClip | null) => void;
  onPflChange?: (side: "A" | "B", on: boolean) => void;
  onKeyLockChange?: (side: "A" | "B", on: boolean) => void;
  private midiLearn: ((kind: "cc" | "note", number: number, channel: number) => void) | null = null;
  private clipVoices: WarpedVoice[] = [];
  private sessionVoices: Record<string, WarpedVoice | null> = {};
  private hpEl: HTMLAudioElement | null = null;
  private hpElPopup: HTMLAudioElement | null = null;
  private cueWin: Window | null = null;
  private hpSinkId = "";

  headphonesSinkId(): string {
    return this.hpSinkId;
  }

  constructor() {
    this.ctx = new AudioContext();
    this.transport = new Transport(this.ctx);
    this.mixer = new Mixer(this.ctx, this.ctx.destination);
    this.decks = {
      A: new Deck(this.ctx, this.mixer.channels.A.input),
      B: new Deck(this.ctx, this.mixer.channels.B.input),
    };
    this.drums = new DrumMachine(this.ctx, this.mixer.channels.drums.input);
    this.synth = new Synth(this.ctx, this.mixer.channels.synth.input);
    this.sampler = new Sampler(this.ctx, this.mixer.channels.drums.input);
    this.timeline = new TimelineEngine();
    this.automation = new AutomationEngine();
    this.piano = new PianoRoll();
    this.launcher = new ClipLauncher();
    for (const side of ["A", "B"] as const) {
      this.decks[side].onPlay = () => this.followStems(side, "play");
      this.decks[side].onPause = () => this.followStems(side, "pause");
      this.decks[side].onSeek = (t) => this.followStems(side, "seek", t);
    }
  }

  async init(): Promise<void> {
    if (this.ready) return;
    await this.ctx.resume();
    await warmupRubberBand(this.ctx);
    await this.drums.init();
    this.drums.attach(this.transport);
    this.drums.onKick = (time) => this.mixer.duckFromKick(time);
    this.timeline.attach(this.transport);
    this.timeline.setHandler((clip, when) => this.playTimelineClip(clip, when));
    this.piano.attach(this.transport, this.synth);
    this.transport.onTick((step, time) => {
      const seconds = step * this.transport.secondsPerStep;
      this.applyAutomation(seconds);
      if (step % 16 === 0) {
        const bar = Math.floor(step / 16);
        const pending = this.launcher.pendingScene;
        this.launcher.onBar(bar);
        if (pending != null && this.launcher.pendingScene == null) {
          for (const track of this.launcher.trackIds()) {
            const clip = this.launcher.active[track] ?? null;
            void this.startSessionClip(track, clip);
            this.onSessionLaunch?.(track, clip);
          }
        }
      }
      this.syncGating(step);
      void time;
    });
    this.ready = true;
  }

  private syncGating(step: number): void {
    const playBar = step / 16;
    if (this.arrangeMode) {
      const inDrums = this.timeline.clips.some(
        (c) => c.trackId === "drums" && playBar >= c.startBar && playBar < c.startBar + c.lengthBars,
      );
      const inSynth = this.timeline.clips.some(
        (c) => c.trackId === "synth" && playBar >= c.startBar && playBar < c.startBar + c.lengthBars,
      );
      this.drums.enabled = inDrums;
      this.piano.enabled = inSynth;
    } else {
      const drumClip = this.launcher.active.drums;
      const synthClip = this.launcher.active.synth;
      // Session: if a clip is launched use it; otherwise drums/synth follow the current mode (always on unless empty launch).
      if (drumClip) this.drums.enabled = !drumClip.empty;
      if (synthClip) this.piano.enabled = !synthClip.empty;
    }
  }

  applyAutomation(seconds: number): void {
    for (const target of this.automation.lanes.keys()) {
      this.automation.apply(target, seconds, (v) => writeAutomationValue(this.mixer, target, v));
    }
  }

  playTimelineClip(clip: TimelineClip, when: number): void {
    if (clip.kind === "audio" && clip.audioFileId) {
      void this.playWarpedAudio(clip, when, false);
    }
    if (clip.kind === "drums" || clip.trackId === "drums") this.drums.enabled = true;
    if (clip.kind === "midi" || clip.trackId === "synth") this.piano.enabled = true;
  }

  private clipDest(trackId: string): AudioNode {
    const id = mixerIdForTrack(trackId);
    if (!this.mixer.channels[id] && !isCoreMixId(id)) this.mixer.addLane(id);
    return this.mixer.clipInput(trackId);
  }

  bufferKey(audioId: string, stem?: string | null): string {
    return stem ? `${audioId}::${stem}` : audioId;
  }

  private async playWarpedAudio(clip: TimelineClip | SessionClip, when: number, loop: boolean): Promise<void> {
    const audioId = clip.audioFileId;
    if (!audioId) return;
    const stem = "stem" in clip ? clip.stem : undefined;
    let buf = this.buffers.get(this.bufferKey(audioId, stem));
    if (!buf) {
      buf = await this.prefetch(audioId, stem);
    }
    const barSec = this.transport.secondsPerStep * 16;
    const lengthBars = Math.max(0.125, clip.lengthBars || 4);
    const fade =
      !loop && "fadeInBars" in clip
        ? {
            fadeInSec: Math.max(0, (clip as TimelineClip).fadeInBars || 0) * barSec,
            fadeOutSec: Math.max(0, (clip as TimelineClip).fadeOutBars || 0) * barSec,
          }
        : undefined;
    const voice = await scheduleWarpedClip(
      this.ctx,
      buf,
      this.clipDest(clip.trackId),
      when,
      loop ? 3600 : lengthBars * barSec,
      {
        sourceBpm: clip.sourceBpm,
        projectBpm: this.transport.bpm,
        sourceKey: clip.sourceKey,
        projectKey: this.projectKey,
        keyFollow: !!clip.keyFollow,
      },
      loop,
      fade,
    );
    this.clipVoices.push(voice);
  }

  stopClips(): void {
    for (const v of this.clipVoices) v.stop();
    this.clipVoices = [];
    for (const k of Object.keys(this.sessionVoices)) {
      this.sessionVoices[k]?.stop();
      this.sessionVoices[k] = null;
    }
  }

  stopSessionTrack(trackId: string): void {
    this.sessionVoices[trackId]?.stop();
    this.sessionVoices[trackId] = null;
    this.launcher.active[trackId] = null;
  }

  async prefetch(audioId: string, stem?: string | null): Promise<AudioBuffer> {
    const key = this.bufferKey(audioId, stem);
    if (this.buffers.has(key)) return this.buffers.get(key)!;
    const url = stem ? api.audio.stemUrl(audioId, stem) : api.audio.streamUrl(audioId);
    const buf = await decodeUrl(this.ctx, url);
    this.buffers.set(key, buf);
    return buf;
  }

  async startSessionClip(trackId: string, clip: SessionClip | null): Promise<void> {
    this.sessionVoices[trackId]?.stop();
    this.sessionVoices[trackId] = null;
    if (!clip || clip.empty) return;
    if (clip.kind !== "audio" || !clip.audioFileId) return;
    const buf = await this.prefetch(clip.audioFileId, clip.stem);
    const voice = await scheduleWarpedClip(
      this.ctx,
      buf,
      this.clipDest(trackId),
      this.ctx.currentTime,
      3600,
      {
        sourceBpm: clip.sourceBpm,
        projectBpm: this.transport.bpm,
        sourceKey: clip.sourceKey,
        projectKey: this.projectKey,
        keyFollow: !!clip.keyFollow,
      },
      true,
    );
    this.sessionVoices[trackId] = voice;
  }

  async loadDeck(side: "A" | "B", audioId: string, beats: number[] = []): Promise<AudioBuffer> {
    const buffer = await this.prefetch(audioId);
    await this.decks[side].loadBuffer(buffer, beats);
    return buffer;
  }

  launch(trackId: string, scene: number): SessionClip | null {
    const clip = this.launcher.launchClip(trackId, scene);
    if (!clip || clip.empty) {
      if (trackId === "drums") this.drums.enabled = false;
      if (trackId === "synth") this.piano.enabled = false;
      void this.startSessionClip(trackId, null);
      this.onSessionLaunch?.(trackId, clip);
      return clip;
    }
    if (clip.kind === "drums") this.drums.enabled = true;
    if (clip.kind === "midi") this.piano.enabled = true;
    void this.startSessionClip(trackId, clip);
    this.onSessionLaunch?.(trackId, clip);
    return clip;
  }

  setNotes(notes: MidiNote[]): void {
    this.piano.setNotes(notes);
  }

  syncDecks(master: "A" | "B", bpmA?: number, bpmB?: number): void {
    const src = master === "A" ? bpmA : bpmB;
    const dstBpm = master === "A" ? bpmB : bpmA;
    const dest = master === "A" ? this.decks.B : this.decks.A;
    if (src && dstBpm) dest.syncToBpm(dstBpm, src);
  }

  setMidiBindings(bindings: MidiBindings): void {
    this.midiBindings = bindings;
    persistMidiBindings(bindings);
  }

  armMidiLearn(cb: (kind: "cc" | "note", number: number, channel: number) => void): void {
    this.midiLearn = cb;
  }

  attachHeadphonesEl(el: HTMLAudioElement): void {
    this.hpEl = el;
    this.keepHeadphonesAlive();
  }

  private wireHpEl(el: HTMLAudioElement | null, play: boolean): void {
    if (!el) return;
    const dest = this.mixer.headphoneDest;
    if (dest && el.srcObject !== dest.stream) el.srcObject = dest.stream;
    if (play) void el.play().catch(() => undefined);
    else el.pause();
    const sink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (this.hpSinkId && typeof sink.setSinkId === "function") {
      void sink.setSinkId(this.hpSinkId).catch(() => undefined);
    }
  }

  keepHeadphonesAlive(): void {
    const popup = !!(this.hpElPopup && this.cueWin && !this.cueWin.closed);
    this.wireHpEl(this.hpEl, !popup);
    this.wireHpEl(this.hpElPopup, popup);
  }

  /** Enumerate outputs without getUserMedia (labels may be blank). Prefer pickHeadphonesOutput(). */
  async listAudioOutputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "audiooutput");
  }

  async pickHeadphonesOutput(): Promise<string> {
    const md = navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: () => Promise<{ deviceId: string }>;
    };
    if (typeof md?.selectAudioOutput === "function") {
      const info = await md.selectAudioOutput();
      return this.setHeadphonesSink(info.deviceId);
    }
    return t("engine.hpNoPicker");
  }

  async setHeadphonesSink(deviceId: string): Promise<string> {
    this.hpSinkId = deviceId;
    const apply = async (el: HTMLAudioElement | null): Promise<boolean> => {
      if (!el) return false;
      const sink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (typeof sink.setSinkId !== "function") return false;
      await sink.setSinkId(deviceId);
      return true;
    };
    const a = await apply(this.hpEl);
    const b = await apply(this.hpElPopup);
    if (!a && !b) {
      if (!this.hpEl && !this.hpElPopup) return t("engine.hpMissing");
      return t("engine.hpNoSink");
    }
    return t("engine.hpRouted");
  }

  /** Blank popup that plays the same headphone MediaStream — not a second SPA/AudioContext. */
  openCueWindow(): string {
    if (this.cueWin && !this.cueWin.closed) {
      this.cueWin.focus();
      this.keepHeadphonesAlive();
      return t("engine.cueOpen");
    }
    const w = window.open("", "forgedeck-cue", "width=420,height=280");
    if (!w) return t("engine.cueBlocked");
    this.cueWin = w;
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ForgeDeck Cue</title>
<style>
  html,body{margin:0;height:100%;background:#0b0b0f;color:#d4d4d8;font:13px/1.4 ui-sans-serif,system-ui,sans-serif}
  main{padding:20px}
  h1{margin:0 0 8px;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#5eead4}
  p{margin:0 0 12px;color:#a1a1aa}
  button{background:#27272a;color:#e4e4e7;border:1px solid #3f3f46;border-radius:6px;padding:6px 10px;cursor:pointer}
</style></head>
<body><main>
  <h1>ForgeDeck · Cue / PFL</h1>
  <p>Same headphone bus as the studio. Not a second audio engine. Choose an output here if the browser offers a picker.</p>
  <button type="button" id="pick">Choose output</button>
  <audio id="cue" autoplay playsinline></audio>
</main>
<script>
  document.getElementById("pick").onclick = async function () {
    var md = navigator.mediaDevices;
    if (!md || !md.selectAudioOutput) { alert("No output picker in this browser"); return; }
    var info = await md.selectAudioOutput();
    var el = document.getElementById("cue");
    if (el && el.setSinkId) await el.setSinkId(info.deviceId);
  };
</script>
</body></html>`);
    w.document.close();
    const el = w.document.getElementById("cue") as HTMLAudioElement | null;
    this.hpElPopup = el;
    const onGone = () => {
      if (this.hpElPopup === el) this.hpElPopup = null;
      if (this.cueWin === w) this.cueWin = null;
      this.keepHeadphonesAlive();
    };
    w.addEventListener("pagehide", onGone);
    w.addEventListener("beforeunload", onGone);
    this.keepHeadphonesAlive();
    return t("engine.cueOpen");
  }

  setPfl(id: string, on: boolean): void {
    this.mixer.setPfl(id, on);
  }

  async enableMidi(): Promise<string> {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) return t("engine.midiUnsupported");
    const access = await nav.requestMIDIAccess();
    access.inputs.forEach((input) => {
      input.onmidimessage = (ev: MIDIMessageEvent) => {
        const d = ev.data;
        if (!d) return;
        const status = d[0] & 0xf0;
        const channel = (d[0] & 0x0f) + 1;
        const number = d[1];
        const vel = d[2] / 127;
        if (status === 0xb0) {
          if (this.midiLearn) {
            this.midiLearn("cc", number, channel);
            this.midiLearn = null;
            return;
          }
          const target = lookupMidiTarget(this.midiBindings, "cc", channel, number);
          if (target) applyMidiTarget(this, target, vel);
          return;
        }
        if (status === 0x90 || status === 0x80) {
          if (this.midiLearn && status === 0x90 && vel > 0) {
            this.midiLearn("note", number, channel);
            this.midiLearn = null;
            return;
          }
          const mapped = lookupMidiTarget(this.midiBindings, "note", channel, number);
          if (mapped) {
            applyMidiTarget(this, mapped, vel, status === 0x90 && vel > 0);
            return;
          }
          if (status === 0x90 && vel > 0) this.synth.noteOn(number, vel);
          if (status === 0x80 || (status === 0x90 && vel === 0)) this.synth.noteOff(number);
        }
      };
    });
    return t("engine.midiReady", { n: [...access.inputs].length });
  }

  startRecording(): void {
    this.recorder.start(this.ctx, this.mixer.limiter.output);
  }

  stopRecording(): AudioBuffer | null {
    return this.recorder.stop();
  }

  async setMic(on: boolean): Promise<string> {
    await this.init();
    if (on) {
      if (this.micStream) return t("engine.micAlready");
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micGain = this.ctx.createGain();
      this.micGain.gain.value = 0.85;
      this.micSource.connect(this.micGain).connect(this.mixer.master.input);
      return t("engine.micLive");
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    try {
      this.micSource?.disconnect();
      this.micGain?.disconnect();
    } catch {
      /* ignore */
    }
    this.micStream = null;
    this.micSource = null;
    this.micGain = null;
    return t("engine.micOff");
  }

  async loadStems(side: "A" | "B", audioId: string, names: string[]): Promise<void> {
    await this.init();
    this.clearStems(side);
    const dest = this.mixer.channels[side].input;
    for (const name of names) {
      const deck = new Deck(this.ctx, dest);
      const buf = await decodeUrl(this.ctx, api.audio.stemUrl(audioId, name));
      await deck.loadBuffer(buf, this.decks[side].beats);
      this.stemDecks[side][name] = deck;
      this.buffers.set(this.bufferKey(audioId, name), buf);
    }
    this.stemsActive[side] = true;
    this.decks[side].output.gain.value = 0;
    if (this.decks[side].playing) this.followStems(side, "play");
  }

  clearStems(side?: "A" | "B"): void {
    const sides = side ? [side] : (["A", "B"] as const);
    for (const s of sides) {
      for (const d of Object.values(this.stemDecks[s])) d.stop();
      this.stemDecks[s] = {};
      this.stemsActive[s] = false;
      this.stemIso[s] = null;
      this.decks[s].output.gain.value = 1;
    }
  }

  setStemMute(name: string, muted: boolean): void {
    for (const side of ["A", "B"] as const) {
      if (this.stemIso[side]) continue;
      const d = this.stemDecks[side][name];
      if (d) d.output.gain.value = muted ? 0 : 1;
    }
  }

  setStemIso(side: "A" | "B", name: string | null, mute: Record<string, boolean> = {}): void {
    this.stemIso[side] = this.stemIso[side] === name ? null : name;
    this.applyStemMix(side, mute);
  }

  applyStemMix(side: "A" | "B", mute: Record<string, boolean>): void {
    const iso = this.stemIso[side];
    for (const [n, d] of Object.entries(this.stemDecks[side])) {
      if (iso) d.output.gain.value = n === iso ? 1 : 0;
      else d.output.gain.value = mute[n] ? 0 : 1;
    }
  }

  private followStems(side: "A" | "B", kind: "play" | "pause" | "seek", time?: number): void {
    if (!this.stemsActive[side]) return;
    const master = this.decks[side];
    const t = time ?? master.position;
    for (const d of Object.values(this.stemDecks[side])) {
      d.pitch = master.pitch;
      d.keyLock = master.keyLock;
      if (kind === "pause") {
        d.pause();
        continue;
      }
      d.seek(t);
      if (kind === "play" && !d.playing) d.play();
    }
  }
}

let singleton: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}
