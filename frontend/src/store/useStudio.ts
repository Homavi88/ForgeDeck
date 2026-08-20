import { create } from "zustand";
import { api } from "../api/client";
import { getEngine } from "../audio-engine/AudioEngine";
import { PAD_IDS } from "../audio-engine/DrumMachine";
import type { AIAction, AudioFile, ChatMessage, DrumSteps, ProjectDetail, StudioMode, SynthParams, TimelineClip } from "../types";

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
  crossfader: number;
  mixer: Record<string, { volume: number; gain: number; eq: [number, number, number]; filter: number; mute: boolean; fx: Record<string, number> }>;
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  currentStep: number;
  synth: SynthParams;
  clips: TimelineClip[];
  conversationId?: string;
  chat: ChatMessage[];
  pendingActions: AIAction[];
  aiBusy: boolean;
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
}

const channelState = () => ({
  volume: 0.85,
  gain: 0,
  eq: [0, 0, 0] as [number, number, number],
  filter: 0,
  mute: false,
  fx: { delay: 0, reverb: 0, flanger: 0, distortion: 0, bitcrush: 0 },
});

function emptySteps(): DrumSteps {
  const steps: DrumSteps = {};
  for (const id of PAD_IDS) steps[id] = Array(64).fill(0);
  return steps;
}

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
  crossfader: 0.5,
  mixer: { A: channelState(), B: channelState(), drums: channelState(), synth: channelState() },
  drumSteps: emptySteps(),
  drumLength: 16,
  drumSwing: 0.08,
  currentStep: 0,
  synth: {
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
  },
  clips: [
    { id: "c1", trackId: "drums", name: "Groove", startBar: 0, lengthBars: 8, color: "#ff6a00" },
    { id: "c2", trackId: "synth", name: "Bass", startBar: 8, lengthBars: 16, color: "#3dfff3" },
  ],
  chat: [
    {
      role: "assistant",
      content: "AI Producer онлайн. Загрузи трек или нажми команду — я предложу cue, переход, drums или mix.",
    },
  ],
  pendingActions: [],
  aiBusy: false,

  setMode: (mode) => set({ mode }),

  setBpm: (bpm) => {
    getEngine().transport.bpm = bpm;
    set({ bpm });
  },

  bootAudio: async () => {
    const eng = getEngine();
    await eng.init();
    eng.decks.A.onPosition = (t) => set({ deckPos: { ...get().deckPos, A: t } });
    eng.decks.B.onPosition = (t) => set({ deckPos: { ...get().deckPos, B: t } });
    eng.transport.onTick((step) => set({ currentStep: step }));
    eng.drums.steps = get().drumSteps;
    eng.drums.length = get().drumLength;
    eng.drums.swing = get().drumSwing;
    eng.synth.setParams(get().synth);
  },

  togglePlay: async () => {
    const eng = getEngine();
    await eng.init();
    if (get().mode === "dj") {
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
    } else {
      eng.transport.metronome = get().metronome;
      eng.transport.toggle();
      set({ playing: eng.transport.playing });
    }
  },

  loadProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const project = await api.projects.get(id);
      const library = await api.audio.list().catch(() => []);
      set({
        project,
        library,
        bpm: project.bpm,
        loading: false,
        synth: { ...get().synth, ...((project.graph as { synth?: SynthParams }).synth || {}) },
      });
      getEngine().transport.bpm = project.bpm;
      if (project.drum_patterns[0]) {
        set({
          drumSteps: { ...emptySteps(), ...project.drum_patterns[0].steps },
          drumLength: project.drum_patterns[0].length,
          drumSwing: project.drum_patterns[0].swing,
        });
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Load failed" });
    }
  },

  refreshLibrary: async () => {
    const library = await api.audio.list();
    set({ library });
  },

  save: async () => {
    const { project, bpm, synth, drumSteps, drumLength, drumSwing, clips, mixer, crossfader, deckFiles } = get();
    if (!project) return;
    set({ saving: true });
    try {
      await api.projects.save(project.id, {
        name: project.name,
        bpm,
        graph: {
          mode: get().mode,
          synth,
          drums: { steps: drumSteps, length: drumLength, swing: drumSwing },
          timeline: { clips },
          mixer,
          crossfader,
          decks: {
            A: { audioFileId: deckFiles.A?.id ?? null },
            B: { audioFileId: deckFiles.B?.id ?? null },
          },
        },
      });
      set({ saving: false });
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : "Save failed" });
    }
  },

  loadToDeck: async (side, file) => {
    await get().bootAudio();
    await getEngine().loadDeck(side, file.id);
    set({ deckFiles: { ...get().deckFiles, [side]: file } });
  },

  uploadFiles: async (files) => {
    set({ loading: true, error: null });
    try {
      for (const file of Array.from(files)) {
        await api.audio.upload(file);
      }
      await get().refreshLibrary();
      set({ loading: false });
      for (let i = 0; i < 6; i++) {
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

  chatAI: async (message, extra = {}) => {
    const project = get().project;
    if (!project) return;
    set({
      aiBusy: true,
      chat: [...get().chat, { role: "user", content: message }],
    });
    try {
      const res = await api.ai.chat(project.id, message, {
        audio_file_id: get().deckFiles.A?.id,
        deck_a_track_id: get().deckFiles.A?.id,
        deck_b_track_id: get().deckFiles.B?.id,
        ...extra,
      }, get().conversationId);
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
    const result = (await api.ai.apply(project.id, pendingActions)) as { applied: Array<{ type: string; ok: boolean; result?: { steps?: DrumSteps; params?: SynthParams; structure?: Array<{ name: string; bars: number }> } }> };
    for (const item of result.applied) {
      if (!item.ok || !item.result) continue;
      if (item.type === "create_drum_pattern" && item.result.steps) {
        const eng = getEngine();
        eng.drums.steps = { ...get().drumSteps, ...item.result.steps };
        set({ drumSteps: { ...get().drumSteps, ...item.result.steps }, mode: "drums" });
      }
      if (item.type === "create_synth_preset" && item.result.params) {
        getEngine().synth.setParams(item.result.params);
        set({ synth: { ...get().synth, ...item.result.params }, mode: "synth" });
      }
      if (item.type === "create_arrangement" && item.result.structure) {
        let bar = 0;
        const clips: TimelineClip[] = item.result.structure.map((s) => {
          const clip = {
            id: crypto.randomUUID(),
            trackId: s.name.toLowerCase().includes("drop") ? "drums" : "synth",
            name: s.name,
            startBar: bar,
            lengthBars: s.bars,
            color: s.name.includes("Drop") ? "#ff6a00" : "#3dfff3",
          };
          bar += s.bars;
          return clip;
        });
        set({ clips, mode: "arrange" });
      }
    }
    await get().loadProject(project.id);
    set({ pendingActions: [] });
  },

  rejectAI: () => set({ pendingActions: [] }),
}));
