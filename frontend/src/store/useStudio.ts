import { create } from "zustand";
import { api } from "../api/client";
import { getEngine } from "../audio-engine/AudioEngine";
import { emptySteps } from "../audio-engine/DrumMachine";
import { applyStripState } from "../audio-engine/stripState";
import type { XfaderCurve } from "../audio-engine/utils";
import { t } from "../i18n";
import { beatOffset, matchGainDb, phaseAlignSeek } from "../lib/djMix";
import { AUDIO_LANE_COLORS, arrangeIdForMix, ensureSessionClips, isCoreMixId, laneColor } from "../lib/mix";
import { parseAutoTarget } from "../lib/automation";
import type {
  AIAction,
  AudioFile,
  AutomationLaneState,
  ChatMessage,
  DrumSteps,
  FxReturnsState,
  MidiNote,
  MidiPattern,
  MixLane,
  MixerStripState,
  ProjectDetail,
  SamplerState,
  SessionClip,
  StylePack,
  StylePackParts,
  StudioMode,
  SynthParams,
  TimelineClip,
} from "../types";
import {
  clampFades,
  cloneClipTo,
  duplicateClip,
  minClipLength,
  normalizeSnap,
  normalizeZoom,
  snapBar,
  splitClipAt,
  type ArrangeSnap,
  type ArrangeZoom,
} from "../lib/clipEdit";
import { loopLengthBars } from "../lib/clipWarp";

type Snapshot = {
  clips: TimelineClip[];
  sessionClips: SessionClip[];
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  synth: SynthParams;
  notes: MidiNote[];
  midiPatterns: MidiPattern[];
  activeMidiPatternId: string;
  mixer: Record<string, MixerStripState>;
  automation: AutomationLaneState[];
  prodLanes: MixLane[];
};

export type Toast = { id: string; kind: "ok" | "info" | "warn" | "err"; text: string; ttl?: number };
export type PitchRange = 8 | 16 | 100;
export type TrackView = { zoom?: number; keyLock?: boolean; pitchRange?: PitchRange };

const LAYOUT_KEY = "fd_layout";

function loadLayout(): { aiPanelOpen: boolean; libraryOpen: boolean } {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { aiPanelOpen: true, libraryOpen: true };
    const p = JSON.parse(raw) as { aiPanelOpen?: boolean; libraryOpen?: boolean };
    return { aiPanelOpen: p.aiPanelOpen !== false, libraryOpen: p.libraryOpen !== false };
  } catch {
    return { aiPanelOpen: true, libraryOpen: true };
  }
}

function persistLayout(aiPanelOpen: boolean, libraryOpen: boolean): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ aiPanelOpen, libraryOpen }));
}

interface StudioState {
  project: ProjectDetail | null;
  mode: StudioMode;
  library: AudioFile[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  bpm: number;
  musicalKey: string;
  metronome: boolean;
  playing: boolean;
  masterLevel: number;
  levels: Record<string, number>;
  deckPos: { A: number; B: number };
  deckFiles: { A: AudioFile | null; B: AudioFile | null };
  keyLock: { A: boolean; B: boolean };
  crossfader: number;
  sidechain: boolean;
  mixer: Record<string, MixerStripState>;
  prodLanes: MixLane[];
  selectedMixId: string;
  selectedClipId: string | null;
  arrangeZoom: ArrangeZoom;
  arrangeSnap: ArrangeSnap;
  clipClipboard: TimelineClip | null;
  selectedAutoTarget: string;
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  currentStep: number;
  synth: SynthParams;
  clips: TimelineClip[];
  notes: MidiNote[];
  midiPatterns: MidiPattern[];
  activeMidiPatternId: string;
  ghostNotes: boolean;
  automation: AutomationLaneState[];
  sessionClips: SessionClip[];
  sampler: SamplerState;
  queue: AudioFile[];
  queueIndex: number;
  autoAdvance: boolean;
  micOn: boolean;
  stemMute: Record<string, boolean>;
  stemIso: { A: string | null; B: string | null };
  fxReturns: FxReturnsState;
  sessionRec: boolean;
  sessionRecOpen: Record<string, { clip: SessionClip; startBar: number }>;
  peers: Array<{ clientId: string; name: string; deck?: string | null }>;
  roomChat: Array<{ clientId: string; name: string; text: string; ts?: number }>;
  locks: Record<string, { clientId: string; name: string }>;
  compatible: Array<{ id: string; original_filename?: string; name?: string; bpm: number; key: string }>;
  conversationId?: string;
  chat: ChatMessage[];
  pendingActions: AIAction[];
  aiBusy: boolean;
  history: Snapshot[];
  future: Snapshot[];
  loadProject: (id: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  save: () => Promise<void>;
  setMode: (m: StudioMode) => void;
  setBpm: (n: number) => void;
  setMusicalKey: (key: string) => void;
  writeNotes: (notes: MidiNote[]) => void;
  selectMidiPattern: (id: string) => void;
  addMidiPattern: () => void;
  removeMidiPattern: (id: string) => void;
  setGhostNotes: (on: boolean) => void;
  bootAudio: () => Promise<void>;
  togglePlay: () => Promise<void>;
  loadToDeck: (side: "A" | "B", file: AudioFile, opts?: { focus?: boolean }) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  pollMeters: () => void;
  chatAI: (message: string, extra?: Record<string, unknown>) => Promise<void>;
  applyAI: () => Promise<void>;
  rejectAI: () => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  applyMixerChannel: (id: string, patch: Partial<MixerStripState>) => void;
  addAudioLane: () => void;
  removeAudioLane: (id: string) => void;
  renameAudioLane: (id: string, name: string) => void;
  selectMix: (id: string) => void;
  setInsertBypass: (id: string, kind: string, on: boolean) => void;
  applyStylePack: (pack: StylePack, parts?: StylePackParts) => Promise<void>;
  xfaderCurve: XfaderCurve;
  setXfaderCurve: (curve: XfaderCurve) => void;
  setEqKill: (id: "A" | "B", band: 0 | 1 | 2, on: boolean) => void;
  instantDouble: (from: "A" | "B") => Promise<void>;
  matchGain: (side: "A" | "B") => void;
  quantizeSync: (slave?: "A" | "B") => void;
  echoOut: (side?: "A" | "B") => void;
  beatOffsetReadout: () => { ms: number; beats: number } | null;
  addToQueue: (file: AudioFile) => void;
  removeFromQueue: (index: number) => void;
  playQueueItem: (index: number, side?: "A" | "B") => Promise<void>;
  advanceQueue: (side: "A" | "B") => Promise<void>;
  focusDeck: "A" | "B";
  pfl: { A: boolean; B: boolean };
  cueMix: number;
  splitCue: boolean;
  headphoneDeviceId: string | null;
  toasts: Toast[];
  aiPanelOpen: boolean;
  libraryOpen: boolean;
  decksFullscreen: boolean;
  keymapOpen: boolean;
  trackView: Record<string, TrackView>;
  pitchRange: { A: PitchRange; B: PitchRange };
  deckZoom: { A: number; B: number };
  lastSavedAt: number | null;
  pushToast: (t: Omit<Toast, "id"> & { id?: string }) => void;
  dismissToast: (id: string) => void;
  setPfl: (side: "A" | "B", on: boolean) => void;
  setCueMix: (v: number) => void;
  setSplitCue: (on: boolean) => void;
  setKeyLock: (side: "A" | "B", on: boolean) => void;
  setDeckZoom: (side: "A" | "B", zoom: number) => void;
  setPitchRange: (side: "A" | "B", range: PitchRange) => void;
  rememberTrackView: (fileId: string, patch: TrackView) => void;
  loadCrateToFocused: (delta: number) => Promise<void>;
  tapTempo: () => void;
  toggleAiPanel: () => void;
  toggleLibrary: () => void;
  toggleDecksFullscreen: () => void;
  placeLoopOnSession: (trackId: string, scene: number, file: AudioFile, stem?: string | null) => void;
  placeLoopOnArrange: (trackId: string, startBar: number, file: AudioFile, stem?: string | null) => void;
  dropStemOnPad: (padId: string, audioFileId: string, stem: string) => Promise<void>;
  toggleSessionRec: () => Promise<void>;
  captureSceneNow: () => void;
  flushSessionRec: () => void;
  noteSessionLaunch: (trackId: string, clip: SessionClip | null) => void;
  toggleClipKeyFollow: (id: string, where: "timeline" | "session") => void;
  setFxReturns: (patch: Partial<FxReturnsState>) => void;
  writeClips: (clips: TimelineClip[], opts?: { undo?: boolean; selectedClipId?: string | null }) => void;
  selectClip: (id: string | null) => void;
  setArrangeZoom: (z: ArrangeZoom) => void;
  setArrangeSnap: (s: ArrangeSnap) => void;
  duplicateSelectedClip: () => void;
  copySelectedClip: () => void;
  pasteClip: () => void;
  deleteSelectedClip: () => void;
  moveClip: (id: string, startBar: number, trackId?: string) => void;
  trimClip: (id: string, startBar: number, lengthBars: number) => void;
  copyClipToTrack: (id: string, startBar: number, trackId: string) => void;
  splitClipAtPlayhead: (id: string) => void;
  setClipFades: (id: string, fadeInBars: number, fadeOutBars: number) => void;
  nudgeSelectedClip: (deltaBars: number) => void;
  setSelectedAutoTarget: (target: string) => void;
  writeAutomation: (target: string, points: AutomationLaneState["points"], opts?: { undo?: boolean }) => void;
  clearAutomation: (target: string) => void;
}

const channelState = (): MixerStripState => ({
  volume: 0.85,
  gain: 0,
  eq: [0, 0, 0],
  eqKill: [false, false, false],
  filter: 0,
  mute: false,
  solo: false,
  pan: 0,
  fx: { delay: 0, reverb: 0, flanger: 0, distortion: 0, bitcrush: 0, compressor: 0 },
  bypass: {},
  sendRev: 0,
  sendDly: 0,
});

const FX_WET_KEYS = new Set(["delay", "reverb", "flanger", "distortion", "bitcrush", "compressor"]);

function mergePackDrums(packSteps: DrumSteps | undefined): DrumSteps {
  const steps = emptySteps();
  for (const [pad, row] of Object.entries(packSteps || {})) {
    if (!Array.isArray(row)) continue;
    const dest = steps[pad] ? [...steps[pad]] : Array(64).fill(0);
    for (let i = 0; i < Math.min(row.length, dest.length); i++) dest[i] = Number(row[i]) || 0;
    steps[pad] = dest;
  }
  return steps;
}

function asMidiNotes(raw: StylePack["notes"] | undefined): MidiNote[] {
  return (raw || []).map((n, i) => ({
    id: String(n.id || `n${i + 1}`),
    pitch: Number(n.pitch),
    startStep: Number(n.startStep),
    length: Math.max(1, Number(n.length) || 1),
    velocity: typeof n.velocity === "number" ? n.velocity : 0.85,
  }));
}

const defaultSynth: SynthParams = {
  oscType: "sawtooth",
  gain: 0.32,
  attack: 0.01,
  decay: 0.18,
  sustain: 0.55,
  release: 0.25,
  cutoff: 1800,
  resonance: 4,
  lfoRate: 4.5,
  lfoDepth: 400,
  lfoTarget: "filter",
  poly: true,
};

function defaultMidiPatterns(notes: MidiNote[] = []): MidiPattern[] {
  return [{ id: "pat-1", name: "Pattern 1", notes }];
}

function patchPatternNotes(patterns: MidiPattern[], id: string, notes: MidiNote[]): MidiPattern[] {
  return patterns.map((p) => (p.id === id ? { ...p, notes } : p));
}

function snapOf(s: StudioState): Snapshot {
  return {
    clips: s.clips,
    sessionClips: s.sessionClips,
    drumSteps: s.drumSteps,
    drumLength: s.drumLength,
    drumSwing: s.drumSwing,
    synth: s.synth,
    notes: s.notes,
    midiPatterns: s.midiPatterns,
    activeMidiPatternId: s.activeMidiPatternId,
    mixer: s.mixer,
    automation: s.automation,
    prodLanes: s.prodLanes,
  };
}

let audioWired = false;
let tapTimes: number[] = [];
const toastTimers = new Map<string, number>();
const echoTimers: Partial<Record<"A" | "B", number>> = {};
const layout0 = loadLayout();

export const useStudio = create<StudioState>((set, get) => ({
  project: null,
  mode: "dj",
  library: [],
  loading: false,
  saving: false,
  error: null,
  bpm: 120,
  musicalKey: "C minor",
  metronome: false,
  playing: false,
  masterLevel: 0,
  levels: { A: 0, B: 0, drums: 0, synth: 0 },
  deckPos: { A: 0, B: 0 },
  deckFiles: { A: null, B: null },
  keyLock: { A: false, B: false },
  crossfader: 0.5,
  xfaderCurve: "smooth",
  sidechain: true,
  mixer: { A: channelState(), B: channelState(), drums: channelState(), synth: channelState() },
  prodLanes: [],
  selectedMixId: "A",
  selectedClipId: null,
  arrangeZoom: 1,
  arrangeSnap: 0.25,
  clipClipboard: null,
  selectedAutoTarget: "deck_a.volume",
  drumSteps: emptySteps(),
  drumLength: 16,
  drumSwing: 0.08,
  currentStep: 0,
  synth: { ...defaultSynth },
  clips: [
    { id: "c1", trackId: "drums", name: "Groove", startBar: 0, lengthBars: 8, color: "#ff6a00", kind: "drums" },
    { id: "c2", trackId: "synth", name: "Bass", startBar: 8, lengthBars: 16, color: "#3dfff3", kind: "midi" },
  ],
  notes: [],
  midiPatterns: [{ id: "pat-1", name: "Pattern 1", notes: [] }],
  activeMidiPatternId: "pat-1",
  ghostNotes: true,
  automation: [],
  sessionClips: [],
  sampler: { audioFileId: null, start: 0, end: 1, reverse: false, loop: false, playbackRate: 1 },
  queue: [],
  queueIndex: 0,
  autoAdvance: true,
  micOn: false,
  stemMute: { vocals: false, drums: false, bass: false, other: false },
  stemIso: { A: null, B: null },
  fxReturns: { reverb: 0.85, delay: 0.85 },
  sessionRec: false,
  sessionRecOpen: {},
  peers: [],
  roomChat: [],
  locks: {},
  compatible: [],
  chat: [],
  pendingActions: [],
  aiBusy: false,
  history: [],
  future: [],
  focusDeck: "A",
  pfl: { A: false, B: false },
  cueMix: 1,
  splitCue: false,
  headphoneDeviceId: null,
  toasts: [],
  aiPanelOpen: layout0.aiPanelOpen,
  libraryOpen: layout0.libraryOpen,
  decksFullscreen: false,
  keymapOpen: false,
  trackView: {},
  pitchRange: { A: 8, B: 8 },
  deckZoom: { A: 1, B: 1 },
  lastSavedAt: null,

  setMode: (mode) => {
    const eng = getEngine();
    eng.arrangeMode = mode === "arrange";
    if (mode === "drums" || mode === "synth") {
      eng.drums.enabled = mode === "drums" ? true : eng.drums.enabled;
      eng.piano.enabled = mode === "synth" ? true : eng.piano.enabled;
    }
    if (mode === "drums") eng.drums.enabled = true;
    if (mode === "synth") eng.piano.enabled = true;
    set({ mode });
  },

  setBpm: (bpm) => {
    getEngine().transport.bpm = bpm;
    set({ bpm });
  },

  setMusicalKey: (musicalKey) => {
    const project = get().project;
    getEngine().projectKey = musicalKey;
    set({ musicalKey, project: project ? { ...project, musical_key: musicalKey } : project });
  },

  writeNotes: (notes) => {
    const s = get();
    const midiPatterns = patchPatternNotes(s.midiPatterns, s.activeMidiPatternId, notes);
    getEngine().setNotes(notes);
    getEngine().piano.setLoopSteps(s.drumLength);
    set({ notes, midiPatterns });
  },

  selectMidiPattern: (id) => {
    const s = get();
    if (id === s.activeMidiPatternId) return;
    const next = s.midiPatterns.find((p) => p.id === id);
    if (!next) return;
    const midiPatterns = patchPatternNotes(s.midiPatterns, s.activeMidiPatternId, s.notes);
    const notes = midiPatterns.find((p) => p.id === id)?.notes || next.notes;
    getEngine().setNotes(notes);
    getEngine().piano.setLoopSteps(s.drumLength);
    set({ midiPatterns, activeMidiPatternId: id, notes });
  },

  addMidiPattern: () => {
    get().pushUndo();
    const s = get();
    const n = s.midiPatterns.length + 1;
    const pat: MidiPattern = { id: crypto.randomUUID(), name: `Pattern ${n}`, notes: [] };
    const midiPatterns = patchPatternNotes(s.midiPatterns, s.activeMidiPatternId, s.notes);
    getEngine().setNotes([]);
    getEngine().piano.setLoopSteps(s.drumLength);
    set({ midiPatterns: [...midiPatterns, pat], activeMidiPatternId: pat.id, notes: [] });
  },

  removeMidiPattern: (id) => {
    const s = get();
    if (s.midiPatterns.length < 2) return;
    get().pushUndo();
    const flushed = patchPatternNotes(s.midiPatterns, s.activeMidiPatternId, s.notes);
    const midiPatterns = flushed.filter((p) => p.id !== id);
    const active = s.activeMidiPatternId === id ? midiPatterns[0].id : s.activeMidiPatternId;
    const notes = midiPatterns.find((p) => p.id === active)?.notes || [];
    getEngine().setNotes(notes);
    getEngine().piano.setLoopSteps(s.drumLength);
    set({ midiPatterns, activeMidiPatternId: active, notes });
  },

  setGhostNotes: (ghostNotes) => set({ ghostNotes }),

  pushUndo: () => {
    const s = get();
    set({ history: [...s.history.slice(-29), snapOf(s)], future: [] });
  },

  undo: () => {
    const { history, future } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    const cur = snapOf(get());
    set({ ...prev, history: history.slice(0, -1), future: [...future, cur] });
    hydrateEngine(get());
  },

  redo: () => {
    const { history, future } = get();
    if (!future.length) return;
    const next = future[future.length - 1];
    const cur = snapOf(get());
    set({ ...next, future: future.slice(0, -1), history: [...history, cur] });
    hydrateEngine(get());
  },

  bootAudio: async () => {
    const eng = getEngine();
    await eng.init();
    if (!audioWired) {
      audioWired = true;
      eng.decks.A.onPosition = (t) => set({ deckPos: { ...get().deckPos, A: t } });
      eng.decks.B.onPosition = (t) => set({ deckPos: { ...get().deckPos, B: t } });
      eng.decks.A.onEnded = () => {
        if (get().autoAdvance) void get().advanceQueue("A");
      };
      eng.decks.B.onEnded = () => {
        if (get().autoAdvance) void get().advanceQueue("B");
      };
      eng.transport.onTick((step) => set({ currentStep: step }));
    }
    const sessionClips = ensureSessionClips(
      get().sessionClips.length ? get().sessionClips : eng.launcher.clips,
      get().prodLanes,
    );
    set({ sessionClips });
    hydrateEngine(get());
    getEngine().onSessionLaunch = (trackId, clip) => get().noteSessionLaunch(trackId, clip);
  },

  togglePlay: async () => {
    const eng = getEngine();
    await get().bootAudio();
    const mode = get().mode;
    if (mode === "dj") {
      const a = eng.decks.A;
      const b = eng.decks.B;
      if (a.playing || b.playing) {
        a.pause();
        b.pause();
        set({ playing: false });
      } else {
        if (a.buffer) a.play();
        if (b.buffer) b.play();
        if (!a.buffer && !b.buffer) {
          eng.transport.metronome = get().metronome;
          eng.transport.start();
        }
        set({ playing: true });
      }
      return;
    }
    eng.arrangeMode = mode === "arrange";
    eng.timeline.clips = get().clips;
    eng.transport.metronome = get().metronome;
    if (eng.transport.playing) {
      eng.transport.stop();
      eng.timeline.reset();
      eng.stopClips();
      eng.synth.allOff();
      if (get().sessionRec) get().flushSessionRec();
      set({ playing: false });
    } else {
      eng.drums.enabled = mode !== "arrange";
      eng.piano.enabled = mode !== "arrange";
      if (mode === "drums") eng.drums.enabled = true;
      if (mode === "synth" || mode === "arrange") eng.piano.enabled = true;
      eng.transport.start();
      set({ playing: true });
    }
  },

  loadProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const project = await api.projects.get(id);
      const library = await api.audio.list().catch(() => []);
      const g = (project.graph || {}) as Record<string, unknown>;
      const drums = (g.drums as { steps?: DrumSteps; length?: number; swing?: number }) || {};
      const mixerIn = (g.mixer as Record<string, MixerStripState>) || {};
      const deckIds = (g.decks as {
        A?: { audioFileId?: string; keyLock?: boolean };
        B?: { audioFileId?: string; keyLock?: boolean };
      }) || {};
      const next: Partial<StudioState> = {
        project,
        library,
        bpm: project.bpm,
        musicalKey: project.musical_key || "C minor",
        loading: false,
        synth: { ...defaultSynth, ...((g.synth as SynthParams) || {}) },
        clips: (g.timeline as { clips?: TimelineClip[] })?.clips || get().clips,
        notes: (g.notes as MidiNote[]) || [],
        midiPatterns: defaultMidiPatterns((g.notes as MidiNote[]) || []),
        activeMidiPatternId: "pat-1",
        ghostNotes: g.ghostNotes !== false,
        automation: (g.automation as AutomationLaneState[]) || [],
        sessionClips: (g.session as SessionClip[]) || get().sessionClips,
        sampler: { ...get().sampler, ...((g.sampler as SamplerState) || {}) },
        sidechain: g.sidechain !== false,
        crossfader: typeof g.crossfader === "number" ? g.crossfader : 0.5,
        xfaderCurve: g.xfaderCurve === "sharp" || g.xfaderCurve === "cut" ? g.xfaderCurve : "smooth",
        autoAdvance: g.autoAdvance !== false,
        fxReturns: {
          reverb: typeof (g.fxReturns as FxReturnsState | undefined)?.reverb === "number"
            ? (g.fxReturns as FxReturnsState).reverb
            : 0.85,
          delay: typeof (g.fxReturns as FxReturnsState | undefined)?.delay === "number"
            ? (g.fxReturns as FxReturnsState).delay
            : 0.85,
        },
        mode: ((g.mode as StudioMode) || "dj") as StudioMode,
        mixer: {
          A: { ...channelState(), ...mixerIn.A },
          B: { ...channelState(), ...mixerIn.B },
          drums: { ...channelState(), ...mixerIn.drums },
          synth: { ...channelState(), ...mixerIn.synth },
        },
      };
      const storedLanes = Array.isArray(g.prodLanes) ? (g.prodLanes as MixLane[]) : [];
      next.prodLanes = storedLanes.filter((l) => l && typeof l.id === "string" && !isCoreMixId(l.id));
      for (const [key, st] of Object.entries(mixerIn)) {
        if (isCoreMixId(key) || !st || typeof st !== "object") continue;
        next.mixer![key] = { ...channelState(), ...st };
        if (!next.prodLanes.some((l) => l.id === key)) {
          next.prodLanes.push({ id: key, name: key, color: laneColor(key), role: "audio" });
        }
      }
      next.selectedMixId = typeof g.selectedMixId === "string" ? g.selectedMixId : "A";
      next.arrangeZoom = normalizeZoom(g.arrangeZoom);
      next.arrangeSnap = normalizeSnap(g.arrangeSnap);
      next.selectedClipId = null;
      next.sessionClips = ensureSessionClips(next.sessionClips || get().sessionClips, next.prodLanes || []);
      next.selectedAutoTarget =
        typeof g.selectedAutoTarget === "string" && g.selectedAutoTarget ? g.selectedAutoTarget : "deck_a.volume";
      if (project.drum_patterns[0] || drums.steps) {
        next.drumSteps = { ...emptySteps(), ...(project.drum_patterns[0]?.steps || drums.steps || {}) };
        next.drumLength = project.drum_patterns[0]?.length || drums.length || 16;
        next.drumSwing = project.drum_patterns[0]?.swing || drums.swing || 0.08;
      }
      const fileA = library.find((f) => f.id === deckIds.A?.audioFileId) || null;
      const fileB = library.find((f) => f.id === deckIds.B?.audioFileId) || null;
      next.deckFiles = { A: fileA, B: fileB };
      const qids = (g.queue as string[]) || [];
      next.queue = qids.map((qid) => library.find((f) => f.id === qid)).filter(Boolean) as AudioFile[];
      next.queueIndex = typeof g.queueIndex === "number" ? (g.queueIndex as number) : 0;
      next.keyLock = { A: !!deckIds.A?.keyLock, B: !!deckIds.B?.keyLock };
      next.trackView = (g.trackView as Record<string, TrackView>) || {};
      const pr = g.pitchRange as { A?: PitchRange; B?: PitchRange } | undefined;
      next.pitchRange = { A: pr?.A === 16 || pr?.A === 100 ? pr.A : 8, B: pr?.B === 16 || pr?.B === 100 ? pr.B : 8 };
      const layout = g.layout as { aiPanelOpen?: boolean; libraryOpen?: boolean } | undefined;
      if (layout) {
        next.aiPanelOpen = layout.aiPanelOpen !== false;
        next.libraryOpen = layout.libraryOpen !== false;
      }
      const storedPatterns = g.midiPatterns as MidiPattern[] | undefined;
      if (Array.isArray(storedPatterns) && storedPatterns.length) {
        const cleaned = storedPatterns
          .filter((p) => p && typeof p.id === "string")
          .map((p, i) => ({
            id: p.id,
            name: typeof p.name === "string" && p.name ? p.name : `Pattern ${i + 1}`,
            notes: Array.isArray(p.notes) ? p.notes : [],
          }));
        if (cleaned.length) {
          const activeId = (g.activeMidiPatternId as string) || cleaned[0].id;
          next.midiPatterns = cleaned;
          next.activeMidiPatternId = cleaned.some((p) => p.id === activeId) ? activeId : cleaned[0].id;
          next.notes = cleaned.find((p) => p.id === next.activeMidiPatternId)?.notes || next.notes || [];
        }
      }
      set(next as StudioState);
      getEngine().transport.bpm = project.bpm;
      if (fileA) {
        void get().loadToDeck("A", fileA).then(() => {
          if (get().keyLock.A) getEngine().decks.A.setKeyLock(true);
        });
      }
      if (fileB) {
        void get().loadToDeck("B", fileB).then(() => {
          if (get().keyLock.B) getEngine().decks.B.setKeyLock(true);
        });
      }
      if (next.mode) get().setMode(next.mode as StudioMode);
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : t("projects.loadFailed") });
    }
  },

  refreshLibrary: async () => {
    const library = await api.audio.list();
    set({ library });
  },

  save: async () => {
    const s = get();
    if (!s.project) return;
    set({ saving: true });
    try {
      await api.projects.save(s.project.id, {
        name: s.project.name,
        bpm: s.bpm,
        musical_key: s.musicalKey,
        graph: {
          version: 2,
          mode: s.mode,
          synth: s.synth,
          drums: { steps: s.drumSteps, length: s.drumLength, swing: s.drumSwing },
          timeline: { clips: s.clips },
          mixer: s.mixer,
          prodLanes: s.prodLanes,
          selectedMixId: s.selectedMixId,
          arrangeZoom: s.arrangeZoom,
          arrangeSnap: s.arrangeSnap,
          selectedAutoTarget: s.selectedAutoTarget,
          crossfader: s.crossfader,
          xfaderCurve: s.xfaderCurve,
          notes: s.notes,
          midiPatterns: s.midiPatterns,
          activeMidiPatternId: s.activeMidiPatternId,
          ghostNotes: s.ghostNotes,
          automation: s.automation,
          session: s.sessionClips,
          sampler: s.sampler,
          sidechain: s.sidechain,
          autoAdvance: s.autoAdvance,
          fxReturns: s.fxReturns,
          queue: s.queue.map((f) => f.id),
          queueIndex: s.queueIndex,
          decks: {
            A: { audioFileId: s.deckFiles.A?.id ?? null, keyLock: s.keyLock.A },
            B: { audioFileId: s.deckFiles.B?.id ?? null, keyLock: s.keyLock.B },
          },
          trackView: s.trackView,
          pitchRange: s.pitchRange,
          layout: { aiPanelOpen: s.aiPanelOpen, libraryOpen: s.libraryOpen },
        },
      });
      set({ saving: false, lastSavedAt: Date.now() });
      get().pushToast({ id: "save", kind: "ok", text: t("toast.saved"), ttl: 1400 });
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : t("toast.saveFailed") });
      get().pushToast({ id: "save", kind: "err", text: err instanceof Error ? err.message : t("toast.saveFailed"), ttl: 4000 });
    }
  },

  loadToDeck: async (side, file, opts) => {
    await get().bootAudio();
    await getEngine().loadDeck(side, file.id, file.analysis?.beats || []);
    const view = get().trackView[file.id];
    const keyLock = view?.keyLock ?? get().keyLock[side];
    const zoom = view?.zoom ?? 1;
    const pitchRange = view?.pitchRange ?? get().pitchRange[side];
    getEngine().decks[side].setKeyLock(keyLock);
    set({
      deckFiles: { ...get().deckFiles, [side]: file },
      keyLock: { ...get().keyLock, [side]: keyLock },
      deckZoom: { ...get().deckZoom, [side]: zoom },
      pitchRange: { ...get().pitchRange, [side]: pitchRange },
      ...(opts?.focus === false ? {} : { focusDeck: side }),
    });
  },

  uploadFiles: async (files) => {
    set({ loading: true, error: null });
    const n = Array.from(files).length;
    get().pushToast({ id: "upload", kind: "info", text: t("toast.uploading", { n }), ttl: 2500 });
    const wasReady = new Set(get().library.filter((f) => f.analysis_status === "ready").map((f) => f.id));
    try {
      for (const file of Array.from(files)) await api.audio.upload(file);
      await get().refreshLibrary();
      set({ loading: false });
      get().pushToast({ id: "upload", kind: "ok", text: t("toast.uploadDone"), ttl: 2200 });
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 700));
        await get().refreshLibrary();
        for (const f of get().library) {
          if (f.analysis_status === "ready" && !wasReady.has(f.id) && f.analysis) {
            wasReady.add(f.id);
            const bpm = f.analysis.bpm ? `${f.analysis.bpm.toFixed(1)} BPM` : "BPM";
            const cam = f.analysis.camelot ? ` · ${f.analysis.camelot}` : "";
            get().pushToast({
              id: `an-${f.id}`,
              kind: "ok",
              text: t("toast.analysisReady", { name: f.original_filename, meta: `${bpm}${cam}` }),
              ttl: 4200,
            });
          }
          if (f.analysis_status === "error" && !wasReady.has(f.id)) {
            wasReady.add(f.id);
            get().pushToast({
              id: `an-${f.id}`,
              kind: "err",
              text: t("toast.analysisFail", { name: f.original_filename }),
              ttl: 5000,
            });
          }
        }
        if (get().library.every((f) => f.analysis_status === "ready" || f.analysis_status === "error")) break;
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : t("toast.uploadFail") });
      get().pushToast({ id: "upload", kind: "err", text: err instanceof Error ? err.message : t("toast.uploadFail"), ttl: 4000 });
    }
  },

  pollMeters: () => {
    const eng = getEngine();
    if (!eng.ready) return;
    const levels: Record<string, number> = {};
    for (const [id, ch] of Object.entries(eng.mixer.channels)) levels[id] = ch.level;
    set({
      masterLevel: eng.mixer.masterLevel,
      levels,
      deckPos: { A: eng.decks.A.position, B: eng.decks.B.position },
      currentStep: eng.transport.currentStep,
      playing: eng.decks.A.playing || eng.decks.B.playing || eng.transport.playing,
    });
  },

  applyMixerChannel: (id, patch) => {
    const mixer = { ...get().mixer, [id]: { ...get().mixer[id], ...patch } };
    set({ mixer });
    const eng = getEngine();
    if (!eng.ready) return;
    if (!eng.mixer.channels[id]) eng.mixer.addLane(id);
    const ch = eng.mixer.channels[id];
    if (!ch) return;
    applyStripState(ch, mixer[id]);
    eng.mixer.setSolo(id, mixer[id].solo);
  },

  selectMix: (id) => set({ selectedMixId: id }),

  setInsertBypass: (id, kind, on) => {
    const st = get().mixer[id];
    if (!st) return;
    get().applyMixerChannel(id, { bypass: { ...(st.bypass || {}), [kind]: on } });
  },

  addAudioLane: () => {
    get().pushUndo();
    const n = get().prodLanes.length + 1;
    const id = `t-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const color = AUDIO_LANE_COLORS[(n - 1) % AUDIO_LANE_COLORS.length];
    const lane: MixLane = { id, name: t("mixer.audioN", { n }), color, role: "audio" };
    const mixer = { ...get().mixer, [id]: channelState() };
    const prodLanes = [...get().prodLanes, lane];
    const sessionClips = ensureSessionClips(get().sessionClips, prodLanes);
    set({ prodLanes, mixer, selectedMixId: id, sessionClips });
    void get().bootAudio().then(() => {
      const ch = getEngine().mixer.addLane(id);
      applyStripState(ch, mixer[id]);
      getEngine().launcher.clips = sessionClips;
    });
    get().pushToast({ id: "lane", kind: "ok", text: t("toast.trackAdded", { name: lane.name }), ttl: 1800 });
  },

  removeAudioLane: (id) => {
    if (isCoreMixId(id)) return;
    get().pushUndo();
    const { [id]: _drop, ...rest } = get().mixer;
    const clips = get().clips.filter((c) => c.trackId !== id);
    const sessionClips = get().sessionClips.filter((c) => c.trackId !== id);
    const prodLanes = get().prodLanes.filter((l) => l.id !== id);
    const selectedMixId = get().selectedMixId === id ? "drums" : get().selectedMixId;
    const automation = get().automation.filter((a) => parseAutoTarget(a.target)?.mixId !== id);
    const selectedAutoTarget =
      parseAutoTarget(get().selectedAutoTarget)?.mixId === id ? "deck_a.volume" : get().selectedAutoTarget;
    set({ mixer: rest, clips, sessionClips, prodLanes, selectedMixId, automation, selectedAutoTarget });
    const eng = getEngine();
    if (eng.ready) {
      eng.mixer.removeLane(id);
      eng.timeline.clips = clips;
      eng.launcher.clips = sessionClips;
      eng.stopSessionTrack(id);
      eng.automation.lanes.clear();
      for (const lane of automation) eng.automation.setLane(lane.target, lane.points);
    }
  },

  renameAudioLane: (id, name) => {
    if (isCoreMixId(id)) return;
    const trimmed = name.trim().slice(0, 32) || id;
    set({
      prodLanes: get().prodLanes.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
    });
  },

  applyStylePack: async (pack, parts = "all") => {
    const wantAll = parts === "all";
    const wantDrums = wantAll || parts === "drums";
    const wantSynth = wantAll || parts === "synth";
    get().pushUndo();
    try {
      await get().bootAudio();
      const eng = getEngine();
      if (wantAll) {
        get().setBpm(pack.bpm);
        get().setMusicalKey(pack.key);
      }
      if (wantDrums) {
        const steps = mergePackDrums(pack.drums?.steps);
        const length = pack.drums?.length || 16;
        const swing = pack.drums?.swing ?? 0;
        eng.drums.steps = steps;
        eng.drums.length = length;
        eng.drums.swing = swing;
        eng.piano.setLoopSteps(length);
        set({ drumSteps: steps, drumLength: length, drumSwing: swing });
      }
      if (wantSynth) {
        const synth = { ...get().synth, ...pack.synth };
        eng.synth.setParams(synth);
        set({ synth });
        get().writeNotes(asMidiNotes(pack.notes));
        if (!wantAll) get().setMusicalKey(pack.key);
      }
      if (wantAll && pack.fx) {
        const aFx = { ...get().mixer.A.fx };
        const bFx = { ...get().mixer.B.fx };
        const drumFx = { ...get().mixer.drums.fx };
        const synthFx = { ...get().mixer.synth.fx };
        for (const [k, v] of Object.entries(pack.fx)) {
          if (typeof v !== "number" || !FX_WET_KEYS.has(k)) continue;
          eng.mixer.channels.A.fx.setWet(k, v);
          eng.mixer.channels.B.fx.setWet(k, v * 0.65);
          eng.mixer.channels.drums.fx.setWet(k, v);
          eng.mixer.channels.synth.fx.setWet(k, v);
          aFx[k] = v;
          bFx[k] = v * 0.65;
          drumFx[k] = v;
          synthFx[k] = v;
        }
        get().applyMixerChannel("A", { fx: aFx });
        get().applyMixerChannel("B", { fx: bFx });
        get().applyMixerChannel("drums", { fx: drumFx });
        get().applyMixerChannel("synth", { fx: synthFx });
      }
      const toastKey = wantAll ? "toast.styleApplied" : wantDrums ? "toast.styleDrums" : "toast.styleSynth";
      get().pushToast({ id: "style", kind: "ok", text: t(toastKey, { name: pack.name }), ttl: 2400 });
    } catch (err) {
      get().pushToast({
        id: "style",
        kind: "err",
        text: err instanceof Error ? err.message : t("toast.styleFailed"),
        ttl: 4000,
      });
    }
  },

  setXfaderCurve: (curve) => {
    getEngine().mixer.setXfaderCurve(curve);
    set({ xfaderCurve: curve });
  },

  setEqKill: (id, band, on) => {
    const cur = get().mixer[id];
    if (!cur) return;
    const eqKill = [...(cur.eqKill || [false, false, false])] as [boolean, boolean, boolean];
    eqKill[band] = on;
    getEngine().mixer.channels[id]?.eq.setKill(band, on);
    set({ mixer: { ...get().mixer, [id]: { ...cur, eqKill } } });
  },

  instantDouble: async (from) => {
    const to: "A" | "B" = from === "A" ? "B" : "A";
    const file = get().deckFiles[from];
    if (!file) {
      get().pushToast({ id: "double", kind: "warn", text: t("toast.doubleEmpty"), ttl: 1800 });
      return;
    }
    await get().bootAudio();
    const eng = getEngine();
    const src = eng.decks[from];
    const pos = src.position;
    const pitch = src.pitch;
    const playing = src.playing;
    const keyLock = src.keyLock;
    const pitchRange = get().pitchRange[from];
    await get().loadToDeck(to, file, { focus: false });
    const dst = eng.decks[to];
    dst.setPitch(pitch);
    dst.setKeyLock(keyLock);
    set({
      keyLock: { ...get().keyLock, [to]: keyLock },
      pitchRange: { ...get().pitchRange, [to]: pitchRange },
    });
    dst.seek(pos, false);
    if (playing && !dst.playing) dst.play();
    if (eng.stemsActive[from]) {
      const names = Object.keys(eng.stemDecks[from]);
      if (names.length) {
        await eng.loadStems(to, file.id, names);
        dst.seek(pos, false);
        if (playing && !dst.playing) dst.play();
      }
    }
    set({ playing: eng.decks.A.playing || eng.decks.B.playing });
    get().pushToast({
      id: "double",
      kind: "ok",
      text: t("toast.doubled", { from, to }),
      ttl: 1800,
    });
  },

  matchGain: (side) => {
    const other: "A" | "B" = side === "A" ? "B" : "A";
    const selfAn = get().deckFiles[side]?.analysis;
    const otherAn = get().deckFiles[other]?.analysis;
    if (!selfAn || !otherAn) {
      get().pushToast({ id: "gain", kind: "warn", text: t("toast.gainNoAnalysis"), ttl: 2000 });
      return;
    }
    const result = matchGainDb(selfAn, otherAn);
    if (!result) {
      get().pushToast({ id: "gain", kind: "warn", text: t("toast.gainNoAnalysis"), ttl: 2000 });
      return;
    }
    const cur = get().mixer[side];
    getEngine().mixer.channels[side]?.setGainDb(result.db);
    set({ mixer: { ...get().mixer, [side]: { ...cur, gain: result.db } } });
    get().pushToast({
      id: "gain",
      kind: "ok",
      text: t(result.clamped ? "toast.gainMatchClamp" : "toast.gainMatch", {
        db: result.db.toFixed(1),
        side,
      }),
      ttl: 2000,
    });
  },

  quantizeSync: (slave) => {
    const s = get();
    const dst = slave || s.focusDeck;
    const master: "A" | "B" = dst === "A" ? "B" : "A";
    const dstFile = s.deckFiles[dst];
    const masterFile = s.deckFiles[master];
    if (!dstFile || !masterFile) {
      get().pushToast({ id: "qsync", kind: "warn", text: t("toast.qSyncEmpty"), ttl: 1800 });
      return;
    }
    const eng = getEngine();
    const dstDeck = eng.decks[dst];
    const masterDeck = eng.decks[master];
    const dstBpm = dstFile.analysis?.bpm || s.bpm;
    const masterBpm = masterFile.analysis?.bpm || s.bpm;
    dstDeck.syncToBpm(dstBpm, masterBpm);
    const tSeek = phaseAlignSeek(
      { position: dstDeck.position, bpm: dstBpm, beats: dstDeck.beats.length ? dstDeck.beats : dstFile.analysis?.beats || [] },
      {
        position: masterDeck.position,
        bpm: masterBpm,
        beats: masterDeck.beats.length ? masterDeck.beats : masterFile.analysis?.beats || [],
      },
    );
    dstDeck.seek(tSeek, false);
    get().pushToast({ id: "qsync", kind: "ok", text: t("toast.qSync", { side: dst }), ttl: 1600 });
  },

  echoOut: (side) => {
    const id = side || get().focusDeck;
    const eng = getEngine();
    const deck = eng.decks[id];
    const ch = eng.mixer.channels[id];
    if (!deck?.buffer || !ch) {
      get().pushToast({ id: "echo", kind: "warn", text: t("toast.echoIdle"), ttl: 1800 });
      return;
    }
    if (!deck.playing) {
      get().pushToast({ id: "echo", kind: "warn", text: t("toast.echoIdle"), ttl: 1800 });
      return;
    }
    if (ch.echoOutActive) return;
    const bpm = get().deckFiles[id]?.analysis?.bpm || get().bpm;
    const beat = 60 / Math.max(60, bpm);
    const prevWet = ch.fx.delay.wet.gain.value;
    const rev = Math.max(ch.fx.reverb.wet.gain.value, 0.28);
    ch.armEchoOut(Math.min(1.5, beat), 0.58, 0.88, rev);
    const fillMs = prevWet < 0.08 ? Math.min(420, beat * 850) : 50;
    window.setTimeout(() => {
      if (!getEngine().mixer.channels[id]) return;
      ch.starveFxSend(0.1);
    }, fillMs);
    const prev = echoTimers[id];
    if (prev) window.clearTimeout(prev);
    echoTimers[id] = window.setTimeout(() => {
      delete echoTimers[id];
      deck.pause();
      ch.restoreFxSend();
      get().applyMixerChannel(id, { mute: true });
      set({ playing: eng.decks.A.playing || eng.decks.B.playing });
    }, fillMs + 2600);
    get().pushToast({ id: "echo", kind: "ok", text: t("toast.echoOut", { side: id }), ttl: 2000 });
  },

  beatOffsetReadout: () => {
    const s = get();
    const fileA = s.deckFiles.A;
    const fileB = s.deckFiles.B;
    if (!fileA || !fileB) return null;
    const eng = getEngine();
    if (!eng.ready) return null;
    return beatOffset(
      {
        position: eng.decks.A.position,
        bpm: fileA.analysis?.bpm || s.bpm,
        beats: eng.decks.A.beats.length ? eng.decks.A.beats : fileA.analysis?.beats || [],
      },
      {
        position: eng.decks.B.position,
        bpm: fileB.analysis?.bpm || s.bpm,
        beats: eng.decks.B.beats.length ? eng.decks.B.beats : fileB.analysis?.beats || [],
      },
    );
  },

  chatAI: async (message, extra = {}) => {
    const project = get().project;
    if (!project) return;
    set({ aiBusy: true, chat: [...get().chat, { role: "user", content: message }] });
    try {
      const res = await api.ai.chat(
        project.id,
        message,
        {
          audio_file_id: get().deckFiles.A?.id,
          deck_a_track_id: get().deckFiles.A?.id,
          deck_b_track_id: get().deckFiles.B?.id,
          ...extra,
        },
        get().conversationId,
      );
      set({
        conversationId: res.conversation_id,
        chat: [...get().chat, { role: "assistant", content: res.message, actions: res.actions }],
        pendingActions: res.actions,
        aiBusy: false,
      });
    } catch (err) {
      set({
        aiBusy: false,
        chat: [...get().chat, { role: "assistant", content: t("ai.error", { msg: err instanceof Error ? err.message : "AI" }) }],
      });
    }
  },

  applyAI: async () => {
    const { project, pendingActions } = get();
    if (!project || !pendingActions.length) return;
    get().pushUndo();
    const result = (await api.ai.apply(project.id, pendingActions)) as {
      applied: Array<{ type: string; ok: boolean; result?: Record<string, unknown> }>;
    };
    const eng = getEngine();
    await eng.init();
    for (const item of result.applied) {
      if (!item.ok) continue;
      const r = item.result || {};
      if (item.type === "create_drum_pattern" && r.steps) {
        const steps = { ...get().drumSteps, ...(r.steps as DrumSteps) };
        eng.drums.steps = steps;
        set({ drumSteps: steps, mode: "drums" });
      }
      if (item.type === "create_synth_preset" && r.params) {
        eng.synth.setParams(r.params as SynthParams);
        set({ synth: { ...get().synth, ...(r.params as SynthParams) }, mode: "synth" });
      }
      if (item.type === "create_arrangement" && r.structure) {
        let bar = 0;
        const clips: TimelineClip[] = (r.structure as Array<{ name: string; bars: number }>).map((s) => {
          const clip: TimelineClip = {
            id: crypto.randomUUID(),
            trackId: s.name.toLowerCase().includes("drop") ? "drums" : "synth",
            name: s.name,
            startBar: bar,
            lengthBars: s.bars,
            color: s.name.includes("Drop") ? "#ff6a00" : "#3dfff3",
            kind: s.name.toLowerCase().includes("drop") ? "drums" : "midi",
          };
          bar += s.bars;
          return clip;
        });
        eng.timeline.clips = clips;
        set({ clips, mode: "arrange" });
      }
      if (item.type === "apply_automation" && r.target && r.points) {
        const lane: AutomationLaneState = {
          target: String(r.target),
          points: r.points as AutomationLaneState["points"],
        };
        eng.automation.setLane(lane.target, lane.points);
        set({ automation: [...get().automation.filter((a) => a.target !== lane.target), lane] });
      }
      if (item.type === "apply_mixer_settings" && r.settings && r.name) {
        const map: Record<string, string> = { "Deck A": "A", "Deck B": "B", Drums: "drums", Synth: "synth" };
        const id = map[String(r.name)] || String(r.name);
        const settings = r.settings as Record<string, number>;
        get().applyMixerChannel(id, {
          volume: settings.volume ?? get().mixer[id]?.volume,
          gain: settings.gain ?? get().mixer[id]?.gain,
          eq: [
            settings.eq_low ?? get().mixer[id]?.eq[0] ?? 0,
            settings.eq_mid ?? get().mixer[id]?.eq[1] ?? 0,
            settings.eq_high ?? get().mixer[id]?.eq[2] ?? 0,
          ],
          filter: settings.filter_knob ?? get().mixer[id]?.filter,
        });
      }
      if (
        (item.type === "create_bassline" || item.type === "create_melody" || item.type === "create_chord_progression") &&
        r.notes
      ) {
        const notes = (r.notes as Array<{ pitch: number; startStep: number; length: number; velocity: number }>).map(
          (n) => ({ ...n, id: crypto.randomUUID() }),
        );
        const merged = item.type === "create_chord_progression" ? notes : [...get().notes, ...notes];
        get().writeNotes(merged);
        set({ mode: "synth" });
      }
      if (item.type === "suggest_compatible_tracks" && r.tracks) {
        set({ compatible: r.tracks as StudioState["compatible"] });
      }
      if (item.type === "create_cue_point" && typeof r.time === "number") {
        const deck = getEngine().decks.A;
        const idx = (r as { hotcue_index?: number }).hotcue_index || Object.keys(deck.hotcues).length + 1;
        deck.hotcues[idx] = Number(r.time);
      }
      if (item.type === "create_loop" && r.start != null && r.end != null) {
        getEngine().decks.A.setLoop(Number(r.start), Number(r.end));
      }
    }
    set({ pendingActions: [] });
  },

  rejectAI: () => set({ pendingActions: [] }),

  addToQueue: (file) => {
    const queue = [...get().queue, file];
    set({ queue });
  },

  removeFromQueue: (index) => {
    const queue = get().queue.filter((_, i) => i !== index);
    set({ queue, queueIndex: Math.min(get().queueIndex, Math.max(0, queue.length - 1)) });
  },

  playQueueItem: async (index, side = "A") => {
    const file = get().queue[index];
    if (!file) return;
    set({ queueIndex: index });
    await get().loadToDeck(side, file);
    getEngine().decks[side].play();
    set({ playing: true });
  },

  advanceQueue: async (side) => {
    const { queue, queueIndex, autoAdvance } = get();
    if (!autoAdvance || !queue.length) return;
    const next = queueIndex + 1;
    if (next >= queue.length) {
      set({ playing: getEngine().decks.A.playing || getEngine().decks.B.playing });
      return;
    }
    await get().playQueueItem(next, side);
  },

  pushToast: (t) => {
    const id = t.id || crypto.randomUUID();
    const ttl = t.ttl ?? 2800;
    const toast: Toast = { kind: t.kind, text: t.text, id, ttl };
    const prev = toastTimers.get(id);
    if (prev) window.clearTimeout(prev);
    set({ toasts: [...get().toasts.filter((x) => x.id !== id), toast] });
    if (ttl > 0) {
      toastTimers.set(
        id,
        window.setTimeout(() => {
          toastTimers.delete(id);
          set({ toasts: get().toasts.filter((x) => x.id !== id) });
        }, ttl),
      );
    }
  },

  dismissToast: (id) => {
    const prev = toastTimers.get(id);
    if (prev) window.clearTimeout(prev);
    toastTimers.delete(id);
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },

  setPfl: (side, on) => {
    getEngine().mixer.setPfl(side, on);
    const pfl = { ...get().pfl, [side]: on };
    set({ pfl });
    if (on && !get().headphoneDeviceId && !get().splitCue) {
      get().pushToast({
        id: "pfl-hint",
        kind: "info",
        text: t("toast.pflHint"),
        ttl: 4500,
      });
    }
  },

  setCueMix: (v) => {
    getEngine().mixer.setCueMix(v);
    set({ cueMix: v });
  },

  setSplitCue: (on) => {
    getEngine().mixer.setSplitCue(on);
    set({ splitCue: on });
  },

  setKeyLock: (side, on) => {
    getEngine().decks[side].setKeyLock(on);
    set({ keyLock: { ...get().keyLock, [side]: on } });
    const file = get().deckFiles[side];
    if (file) get().rememberTrackView(file.id, { keyLock: on });
  },

  setDeckZoom: (side, zoom) => {
    set({ deckZoom: { ...get().deckZoom, [side]: zoom } });
    const file = get().deckFiles[side];
    if (file) get().rememberTrackView(file.id, { zoom });
  },

  setPitchRange: (side, range) => {
    set({ pitchRange: { ...get().pitchRange, [side]: range } });
    const file = get().deckFiles[side];
    if (file) get().rememberTrackView(file.id, { pitchRange: range });
    const pitch = getEngine().decks[side].pitch;
    if (Math.abs(pitch) > range) getEngine().decks[side].setPitch(Math.max(-range, Math.min(range, pitch)));
  },

  rememberTrackView: (fileId, patch) => {
    const cur = get().trackView[fileId] || {};
    set({ trackView: { ...get().trackView, [fileId]: { ...cur, ...patch } } });
  },

  loadCrateToFocused: async (delta) => {
    const s = get();
    const side = s.focusDeck;
    if (s.queue.length) {
      let next = s.queueIndex + delta;
      if (next < 0) next = s.queue.length - 1;
      if (next >= s.queue.length) next = 0;
      const file = s.queue[next];
      if (!file) return;
      set({ queueIndex: next });
      await s.loadToDeck(side, file);
      get().pushToast({ id: "load", kind: "info", text: t("toast.loaded", { name: file.original_filename, side }), ttl: 1800 });
      return;
    }
    if (!s.library.length) return;
    const cur = s.deckFiles[side]?.id;
    const i = s.library.findIndex((f) => f.id === cur);
    const base = i < 0 ? (delta > 0 ? -1 : s.library.length) : i;
    let next = base + delta;
    if (next < 0) next = s.library.length - 1;
    if (next >= s.library.length) next = 0;
    const file = s.library[next];
    await s.loadToDeck(side, file);
    get().pushToast({ id: "load", kind: "info", text: t("toast.loaded", { name: file.original_filename, side }), ttl: 1800 });
  },

  tapTempo: () => {
    const now = performance.now();
    tapTimes = tapTimes.filter((t) => now - t < 2200);
    tapTimes.push(now);
    if (tapTimes.length < 2) {
      get().pushToast({ id: "tap", kind: "info", text: t("toast.tap"), ttl: 900 });
      return;
    }
    const spans = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    const avg = spans.reduce((a, b) => a + b, 0) / spans.length;
    const bpm = Math.min(240, Math.max(60, Math.round((60000 / avg) * 10) / 10));
    get().setBpm(bpm);
    const side = get().focusDeck;
    const file = get().deckFiles[side];
    if (file?.analysis?.bpm) getEngine().decks[side].syncToBpm(file.analysis.bpm, bpm);
    get().pushToast({ id: "tap", kind: "ok", text: t("toast.tapBpm", { bpm: bpm.toFixed(1) }), ttl: 1600 });
  },

  toggleAiPanel: () => {
    const aiPanelOpen = !get().aiPanelOpen;
    set({ aiPanelOpen, decksFullscreen: false });
    persistLayout(aiPanelOpen, get().libraryOpen);
  },

  toggleLibrary: () => {
    const libraryOpen = !get().libraryOpen;
    set({ libraryOpen, decksFullscreen: false });
    persistLayout(get().aiPanelOpen, libraryOpen);
  },

  toggleDecksFullscreen: () => {
    const on = !get().decksFullscreen;
    if (on) set({ decksFullscreen: true, aiPanelOpen: false, libraryOpen: false });
    else {
      const l = loadLayout();
      set({ decksFullscreen: false, aiPanelOpen: l.aiPanelOpen, libraryOpen: l.libraryOpen });
    }
  },

  setFxReturns: (patch) => {
    const fxReturns = { ...get().fxReturns, ...patch };
    const eng = getEngine();
    if (typeof patch.reverb === "number") eng.mixer.setReturnLevel("reverb", patch.reverb);
    if (typeof patch.delay === "number") eng.mixer.setReturnLevel("delay", patch.delay);
    set({ fxReturns });
  },

  placeLoopOnSession: (trackId, scene, file, stem) => {
    get().pushUndo();
    const eng = getEngine();
    const clips = [...(get().sessionClips.length ? get().sessionClips : eng.launcher.clips)];
    const src = file.analysis;
    const lengthBars = loopLengthBars(src?.duration, src?.bpm);
    const name = stem ? `${stem} · ${file.original_filename}` : file.original_filename;
    const i = clips.findIndex((c) => c.trackId === trackId && c.scene === scene);
    const next: SessionClip = {
      id: i >= 0 ? clips[i].id : `${trackId}-${scene}`,
      trackId,
      scene,
      name,
      kind: "audio",
      lengthBars,
      color: laneColor(trackId, get().prodLanes),
      empty: false,
      audioFileId: file.id,
      stem: stem ?? null,
      sourceBpm: src?.bpm ?? null,
      sourceKey: src?.key ?? null,
      keyFollow: false,
    };
    if (i >= 0) clips[i] = next;
    else clips.push(next);
    const sessionClips = ensureSessionClips(clips, get().prodLanes);
    eng.launcher.clips = sessionClips;
    set({ sessionClips });
    void get().bootAudio().then(() => {
      void eng.prefetch(file.id, stem);
    });
  },

  placeLoopOnArrange: (trackId, startBar, file, stem) => {
    get().pushUndo();
    const src = file.analysis;
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      trackId,
      name: stem ? `${stem} · ${file.original_filename}` : file.original_filename,
      startBar: snapBar(startBar, get().arrangeSnap),
      lengthBars: loopLengthBars(src?.duration, src?.bpm),
      color: laneColor(trackId, get().prodLanes),
      kind: "audio",
      audioFileId: file.id,
      stem: stem ?? null,
      sourceBpm: src?.bpm ?? null,
      sourceKey: src?.key ?? null,
      keyFollow: false,
    };
    const clips = [...get().clips, clip];
    getEngine().timeline.clips = clips;
    set({ clips, selectedClipId: clip.id });
    void get().bootAudio().then(() => {
      void getEngine().prefetch(file.id, stem);
    });
  },

  dropStemOnPad: async (padId, audioFileId, stem) => {
    await get().bootAudio();
    const buf = await getEngine().prefetch(audioFileId, stem);
    getEngine().drums.assign(padId, buf);
    get().pushToast({ id: "stem-pad", kind: "ok", text: t("toast.stemPad", { stem, pad: padId }), ttl: 1800 });
  },

  noteSessionLaunch: (trackId, clip) => {
    const s = get();
    if (!s.sessionRec) return;
    const bar = Math.max(0, Math.floor(s.currentStep / 16));
    const open = { ...s.sessionRecOpen };
    const prev = open[trackId];
    let clips = s.clips;
    if (prev && bar > prev.startBar) {
      clips = [...clips, sessionToTimeline(prev.clip, prev.startBar, bar - prev.startBar)];
      getEngine().timeline.clips = clips;
    }
    if (clip && !clip.empty) open[trackId] = { clip, startBar: bar };
    else delete open[trackId];
    set({ clips, sessionRecOpen: open });
  },

  flushSessionRec: () => {
    const s = get();
    const bar = Math.max(0, Math.floor(s.currentStep / 16));
    const extra: TimelineClip[] = [];
    for (const rec of Object.values(s.sessionRecOpen)) {
      extra.push(sessionToTimeline(rec.clip, rec.startBar, Math.max(1, bar - rec.startBar)));
    }
    if (!extra.length) {
      set({ sessionRec: false, sessionRecOpen: {} });
      return;
    }
    const clips = [...s.clips, ...extra];
    getEngine().timeline.clips = clips;
    set({ clips, sessionRec: false, sessionRecOpen: {} });
    get().pushToast({
      id: "session-rec",
      kind: "ok",
      text: t("toast.sessionCaptured", { n: extra.length }),
      ttl: 2800,
    });
  },

  toggleSessionRec: async () => {
    await get().bootAudio();
    const s = get();
    if (s.sessionRec) {
      get().flushSessionRec();
      return;
    }
    const eng = getEngine();
    const bar = Math.max(0, Math.floor(s.currentStep / 16));
    const open: Record<string, { clip: SessionClip; startBar: number }> = {};
    for (const [trackId, clip] of Object.entries(eng.launcher.active)) {
      if (clip && !clip.empty) open[trackId] = { clip, startBar: bar };
    }
    set({ sessionRec: true, sessionRecOpen: open });
    if (s.mode !== "session") get().setMode("session");
    if (!s.playing) void get().togglePlay();
    get().pushToast({ id: "session-rec", kind: "info", text: t("toast.sessionRecOn"), ttl: 2200 });
  },

  captureSceneNow: () => {
    const eng = getEngine();
    const bar = Math.max(0, Math.floor(get().currentStep / 16));
    const extra: TimelineClip[] = [];
    for (const clip of Object.values(eng.launcher.active)) {
      if (clip && !clip.empty) extra.push(sessionToTimeline(clip, bar, Math.max(1, clip.lengthBars)));
    }
    if (!extra.length) {
      get().pushToast({ id: "session-cap", kind: "warn", text: t("toast.sessionEmpty"), ttl: 2000 });
      return;
    }
    get().pushUndo();
    const clips = [...get().clips, ...extra];
    eng.timeline.clips = clips;
    set({ clips, mode: "arrange" });
    eng.arrangeMode = true;
    get().pushToast({
      id: "session-cap",
      kind: "ok",
      text: t("toast.sessionCaptured", { n: extra.length }),
      ttl: 2800,
    });
  },

  toggleClipKeyFollow: (id, where) => {
    if (where === "timeline") {
      const clips = get().clips.map((c) => (c.id === id ? { ...c, keyFollow: !c.keyFollow } : c));
      getEngine().timeline.clips = clips;
      set({ clips });
      return;
    }
    const sessionClips = get().sessionClips.map((c) => (c.id === id ? { ...c, keyFollow: !c.keyFollow } : c));
    getEngine().launcher.clips = sessionClips;
    set({ sessionClips });
  },

  writeClips: (clips, opts) => {
    if (opts?.undo) get().pushUndo();
    getEngine().timeline.clips = clips;
    const patch: Partial<StudioState> = { clips };
    if (opts && "selectedClipId" in opts) patch.selectedClipId = opts.selectedClipId ?? null;
    set(patch);
  },

  selectClip: (id) => set({ selectedClipId: id }),

  setArrangeZoom: (z) => set({ arrangeZoom: normalizeZoom(z) }),

  setArrangeSnap: (s) => set({ arrangeSnap: normalizeSnap(s) }),

  duplicateSelectedClip: () => {
    const { clips, selectedClipId } = get();
    const src = clips.find((c) => c.id === selectedClipId);
    if (!src) return;
    const next = duplicateClip(src);
    get().writeClips([...clips, next], { undo: true, selectedClipId: next.id });
  },

  copySelectedClip: () => {
    const { clips, selectedClipId } = get();
    const src = clips.find((c) => c.id === selectedClipId);
    if (!src) return;
    set({ clipClipboard: { ...src } });
  },

  pasteClip: () => {
    const s = get();
    if (!s.clipClipboard) return;
    const playBar = snapBar(s.currentStep / 16, s.arrangeSnap);
    const trackId = arrangeIdForMix(s.selectedMixId);
    const next = cloneClipTo(s.clipClipboard, playBar, trackId);
    next.color = laneColor(trackId, s.prodLanes);
    get().writeClips([...s.clips, next], { undo: true, selectedClipId: next.id });
  },

  deleteSelectedClip: () => {
    const { clips, selectedClipId } = get();
    if (!selectedClipId || !clips.some((c) => c.id === selectedClipId)) return;
    get().writeClips(
      clips.filter((c) => c.id !== selectedClipId),
      { undo: true, selectedClipId: null },
    );
  },

  moveClip: (id, startBar, trackId) => {
    const { clips, arrangeSnap, prodLanes } = get();
    const snap = arrangeSnap;
    const next = clips.map((c) => {
      if (c.id !== id) return c;
      const patch: TimelineClip = { ...c, startBar: snapBar(startBar, snap) };
      if (trackId && trackId !== c.trackId) {
        patch.trackId = trackId;
        patch.color = laneColor(trackId, prodLanes);
      }
      return patch;
    });
    getEngine().timeline.clips = next;
    set({ clips: next, selectedClipId: id });
  },

  trimClip: (id, startBar, lengthBars) => {
    const snap = get().arrangeSnap;
    const minLen = minClipLength(snap);
    const next = get().clips.map((c) => {
      if (c.id !== id) return c;
      const start = snapBar(Math.max(0, startBar), snap);
      const rawEnd = Math.max(start + minLen, startBar + lengthBars);
      const end = snapBar(rawEnd, snap);
      const length = Math.max(minLen, end - start);
      const fades = clampFades(length, c.fadeInBars, c.fadeOutBars);
      return { ...c, startBar: start, lengthBars: length, ...fades };
    });
    getEngine().timeline.clips = next;
    set({ clips: next, selectedClipId: id });
  },

  copyClipToTrack: (id, startBar, trackId) => {
    const { clips, arrangeSnap, prodLanes } = get();
    const src = clips.find((c) => c.id === id);
    if (!src) return;
    const next = cloneClipTo(src, snapBar(startBar, arrangeSnap), trackId);
    next.color = laneColor(trackId, prodLanes);
    get().writeClips([...clips, next], { undo: true, selectedClipId: next.id });
  },

  splitClipAtPlayhead: (id) => {
    const s = get();
    const at = snapBar(s.currentStep / 16, s.arrangeSnap);
    const src = s.clips.find((c) => c.id === id);
    if (!src) return;
    const parts = splitClipAt(src, at);
    if (!parts) return;
    get().writeClips(
      s.clips.flatMap((c) => (c.id === id ? parts : [c])),
      { undo: true, selectedClipId: parts[0].id },
    );
  },

  setClipFades: (id, fadeInBars, fadeOutBars) => {
    const next = get().clips.map((c) => {
      if (c.id !== id) return c;
      return { ...c, ...clampFades(c.lengthBars, fadeInBars, fadeOutBars) };
    });
    getEngine().timeline.clips = next;
    set({ clips: next, selectedClipId: id });
  },

  nudgeSelectedClip: (deltaBars) => {
    const { clips, selectedClipId } = get();
    const src = clips.find((c) => c.id === selectedClipId);
    if (!src) return;
    get().pushUndo();
    get().moveClip(src.id, src.startBar + deltaBars);
  },

  setSelectedAutoTarget: (target) => set({ selectedAutoTarget: target }),

  writeAutomation: (target, points, opts) => {
    if (opts?.undo) get().pushUndo();
    const automation = [...get().automation.filter((a) => a.target !== target)];
    if (points.length) automation.push({ target, points });
    const eng = getEngine();
    if (eng.ready) {
      if (points.length) eng.automation.setLane(target, points);
      else eng.automation.lanes.delete(target);
    }
    set({ automation, selectedAutoTarget: target });
  },

  clearAutomation: (target) => {
    get().writeAutomation(target, [], { undo: true });
  },
}));

function hydrateEngine(s: StudioState): void {
  const eng = getEngine();
  if (!eng.ready) return;
  eng.transport.bpm = s.bpm;
  eng.drums.steps = s.drumSteps;
  eng.drums.length = s.drumLength;
  eng.drums.swing = s.drumSwing;
  eng.piano.setLoopSteps(s.drumLength);
  eng.synth.setParams(s.synth);
  eng.setNotes(s.notes);
  eng.timeline.clips = s.clips;
  eng.launcher.clips = ensureSessionClips(s.sessionClips, s.prodLanes);
  eng.mixer.sidechain = s.sidechain;
  eng.mixer.setXfaderCurve(s.xfaderCurve);
  eng.mixer.setCrossfader(s.crossfader);
  eng.mixer.setCueMix(s.cueMix);
  eng.mixer.setSplitCue(s.splitCue);
  eng.mixer.setPfl("A", s.pfl.A);
  eng.mixer.setPfl("B", s.pfl.B);
  eng.mixer.setReturnLevel("reverb", s.fxReturns.reverb);
  eng.mixer.setReturnLevel("delay", s.fxReturns.delay);
  eng.projectKey = s.musicalKey;
  eng.arrangeMode = s.mode === "arrange";
  for (const lane of s.automation) eng.automation.setLane(lane.target, lane.points);
  for (const id of Object.keys(s.mixer)) {
    if (!eng.mixer.channels[id]) eng.mixer.addLane(id);
    const st = s.mixer[id];
    if (!st) continue;
    applyStripState(eng.mixer.channels[id], st);
    eng.mixer.setSolo(id, st.solo);
  }
}

function sessionToTimeline(clip: SessionClip, startBar: number, lengthBars: number): TimelineClip {
  return {
    id: crypto.randomUUID(),
    trackId: clip.trackId,
    name: clip.name,
    startBar,
    lengthBars: Math.max(1, lengthBars),
    color: clip.color,
    kind: clip.kind === "midi" ? "midi" : clip.kind === "drums" ? "drums" : "audio",
    audioFileId: clip.audioFileId,
    stem: clip.stem,
    sourceBpm: clip.sourceBpm,
    sourceKey: clip.sourceKey,
    keyFollow: clip.keyFollow,
  };
}
