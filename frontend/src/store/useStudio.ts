import { create } from "zustand";
import { api } from "../api/client";
import { getEngine } from "../audio-engine/AudioEngine";
import { PAD_IDS } from "../audio-engine/DrumMachine";
import { applyStripState } from "../audio-engine/stripState";
import type {
  AIAction,
  AudioFile,
  AutomationLaneState,
  ChatMessage,
  DrumSteps,
  MidiNote,
  MixerStripState,
  ProjectDetail,
  SamplerState,
  SessionClip,
  StudioMode,
  SynthParams,
  TimelineClip,
} from "../types";

type Snapshot = {
  clips: TimelineClip[];
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  synth: SynthParams;
  notes: MidiNote[];
  mixer: Record<string, MixerStripState>;
  automation: AutomationLaneState[];
};

interface StudioState {
  project: ProjectDetail | null;
  mode: StudioMode;
  library: AudioFile[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  bpm: number;
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
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  currentStep: number;
  synth: SynthParams;
  clips: TimelineClip[];
  notes: MidiNote[];
  automation: AutomationLaneState[];
  sessionClips: SessionClip[];
  sampler: SamplerState;
  queue: AudioFile[];
  queueIndex: number;
  autoAdvance: boolean;
  micOn: boolean;
  stemMute: Record<string, boolean>;
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
  bootAudio: () => Promise<void>;
  togglePlay: () => Promise<void>;
  loadToDeck: (side: "A" | "B", file: AudioFile) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  pollMeters: () => void;
  chatAI: (message: string, extra?: Record<string, unknown>) => Promise<void>;
  applyAI: () => Promise<void>;
  rejectAI: () => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  applyMixerChannel: (id: string, patch: Partial<MixerStripState>) => void;
  addToQueue: (file: AudioFile) => void;
  removeFromQueue: (index: number) => void;
  playQueueItem: (index: number, side?: "A" | "B") => Promise<void>;
  advanceQueue: (side: "A" | "B") => Promise<void>;
}

const channelState = (): MixerStripState => ({
  volume: 0.85,
  gain: 0,
  eq: [0, 0, 0],
  filter: 0,
  mute: false,
  solo: false,
  pan: 0,
  fx: { delay: 0, reverb: 0, flanger: 0, distortion: 0, bitcrush: 0, compressor: 0 },
});

function emptySteps(): DrumSteps {
  const steps: DrumSteps = {};
  for (const id of PAD_IDS) steps[id] = Array(64).fill(0);
  return steps;
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

function snapOf(s: Omit<Snapshot, never> & Partial<StudioState>): Snapshot {
  return {
    clips: s.clips,
    drumSteps: s.drumSteps,
    drumLength: s.drumLength,
    drumSwing: s.drumSwing,
    synth: s.synth,
    notes: s.notes,
    mixer: s.mixer,
    automation: s.automation,
  };
}

let audioWired = false;

export const useStudio = create<StudioState>((set, get) => ({
  project: null,
  mode: "dj",
  library: [],
  loading: false,
  saving: false,
  error: null,
  bpm: 120,
  metronome: false,
  playing: false,
  masterLevel: 0,
  levels: { A: 0, B: 0, drums: 0, synth: 0 },
  deckPos: { A: 0, B: 0 },
  deckFiles: { A: null, B: null },
  keyLock: { A: false, B: false },
  crossfader: 0.5,
  sidechain: true,
  mixer: { A: channelState(), B: channelState(), drums: channelState(), synth: channelState() },
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
  automation: [],
  sessionClips: [],
  sampler: { audioFileId: null, start: 0, end: 1, reverse: false, loop: false, playbackRate: 1 },
  queue: [],
  queueIndex: 0,
  autoAdvance: true,
  micOn: false,
  stemMute: { vocals: false, drums: false, bass: false, other: false },
  peers: [],
  roomChat: [],
  locks: {},
  compatible: [],
  chat: [
    {
      role: "assistant",
      content: "AI Producer онлайн. Могу разметить cue, переход, drums, bassline/melody, stems и mix.",
    },
  ],
  pendingActions: [],
  aiBusy: false,
  history: [],
  future: [],

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
    hydrateEngine(get());
    if (!get().sessionClips.length) {
      set({ sessionClips: eng.launcher.clips });
    } else {
      eng.launcher.clips = get().sessionClips;
    }
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
      eng.stopClips();
      eng.synth.allOff();
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
        loading: false,
        synth: { ...defaultSynth, ...((g.synth as SynthParams) || {}) },
        clips: (g.timeline as { clips?: TimelineClip[] })?.clips || get().clips,
        notes: (g.notes as MidiNote[]) || [],
        automation: (g.automation as AutomationLaneState[]) || [],
        sessionClips: (g.session as SessionClip[]) || get().sessionClips,
        sampler: { ...get().sampler, ...((g.sampler as SamplerState) || {}) },
        sidechain: g.sidechain !== false,
        crossfader: typeof g.crossfader === "number" ? g.crossfader : 0.5,
        autoAdvance: g.autoAdvance !== false,
        mode: ((g.mode as StudioMode) || "dj") as StudioMode,
        mixer: {
          A: { ...channelState(), ...mixerIn.A },
          B: { ...channelState(), ...mixerIn.B },
          drums: { ...channelState(), ...mixerIn.drums },
          synth: { ...channelState(), ...mixerIn.synth },
        },
      };
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
      set({ loading: false, error: err instanceof Error ? err.message : "Load failed" });
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
        graph: {
          version: 2,
          mode: s.mode,
          synth: s.synth,
          drums: { steps: s.drumSteps, length: s.drumLength, swing: s.drumSwing },
          timeline: { clips: s.clips },
          mixer: s.mixer,
          crossfader: s.crossfader,
          notes: s.notes,
          automation: s.automation,
          session: s.sessionClips,
          sampler: s.sampler,
          sidechain: s.sidechain,
          autoAdvance: s.autoAdvance,
          queue: s.queue.map((f) => f.id),
          queueIndex: s.queueIndex,
          decks: {
            A: { audioFileId: s.deckFiles.A?.id ?? null, keyLock: s.keyLock.A },
            B: { audioFileId: s.deckFiles.B?.id ?? null, keyLock: s.keyLock.B },
          },
        },
      });
      if (s.project.id) {
        await api.projects.savePattern(s.project.id, {
          name: "Main",
          length: s.drumLength,
          swing: s.drumSwing,
          bpm: s.bpm,
          steps: s.drumSteps,
        }).catch(() => undefined);
      }
      set({ saving: false });
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : "Save failed" });
    }
  },

  loadToDeck: async (side, file) => {
    await get().bootAudio();
    await getEngine().loadDeck(side, file.id, file.analysis?.beats || []);
    set({ deckFiles: { ...get().deckFiles, [side]: file } });
  },

  uploadFiles: async (files) => {
    set({ loading: true, error: null });
    try {
      for (const file of Array.from(files)) await api.audio.upload(file);
      await get().refreshLibrary();
      set({ loading: false });
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700));
        await get().refreshLibrary();
        if (get().library.every((f) => f.analysis_status === "ready" || f.analysis_status === "error")) break;
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Upload failed" });
    }
  },

  pollMeters: () => {
    const eng = getEngine();
    if (!eng.ready) return;
    set({
      masterLevel: eng.mixer.masterLevel,
      levels: {
        A: eng.mixer.channels.A.level,
        B: eng.mixer.channels.B.level,
        drums: eng.mixer.channels.drums.level,
        synth: eng.mixer.channels.synth.level,
      },
      deckPos: { A: eng.decks.A.position, B: eng.decks.B.position },
      currentStep: eng.transport.currentStep,
      playing: eng.decks.A.playing || eng.decks.B.playing || eng.transport.playing,
    });
  },

  applyMixerChannel: (id, patch) => {
    const mixer = { ...get().mixer, [id]: { ...get().mixer[id], ...patch } };
    set({ mixer });
    const ch = getEngine().mixer.channels[id];
    if (!ch) return;
    applyStripState(ch, mixer[id]);
    getEngine().mixer.setSolo(id, mixer[id].solo);
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
        chat: [...get().chat, { role: "assistant", content: `Ошибка: ${err instanceof Error ? err.message : "AI"}` }],
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
        eng.setNotes(merged);
        set({ notes: merged, mode: "synth" });
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
}));

function hydrateEngine(s: StudioState): void {
  const eng = getEngine();
  if (!eng.ready) return;
  eng.transport.bpm = s.bpm;
  eng.drums.steps = s.drumSteps;
  eng.drums.length = s.drumLength;
  eng.drums.swing = s.drumSwing;
  eng.synth.setParams(s.synth);
  eng.setNotes(s.notes);
  eng.timeline.clips = s.clips;
  eng.mixer.sidechain = s.sidechain;
  eng.mixer.setCrossfader(s.crossfader);
  eng.arrangeMode = s.mode === "arrange";
  for (const lane of s.automation) eng.automation.setLane(lane.target, lane.points);
  for (const id of Object.keys(s.mixer)) {
    const ch = eng.mixer.channels[id];
    const st = s.mixer[id];
    if (!ch || !st) continue;
    ch.setVolume(st.volume);
    ch.setGainDb(st.gain);
    ch.eq.set(st.eq[0], st.eq[1], st.eq[2]);
    ch.filter.setKnob(st.filter);
    ch.setPan(st.pan);
    ch.setMute(st.mute);
    eng.mixer.setSolo(id, st.solo);
  }
}
