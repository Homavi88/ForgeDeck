import { useEffect, useRef } from "react";
import { getEngine } from "../audio-engine/AudioEngine";
import { useStudio } from "../store/useStudio";
import type { MixerStripState, MidiNote, StudioMode, SynthParams, TimelineClip, DrumSteps } from "../types";

const WS = import.meta.env.VITE_WS_URL || "";

type CollabSnapshot = {
  clientId: string;
  bpm: number;
  playing: boolean;
  crossfader: number;
  mode: StudioMode;
  sidechain: boolean;
  mixer: Record<string, MixerStripState>;
  keyLock: { A: boolean; B: boolean };
  deckA: string | null;
  deckB: string | null;
  drumSteps: DrumSteps;
  drumLength: number;
  drumSwing: number;
  notes: MidiNote[];
  clips: TimelineClip[];
  synth: SynthParams;
};

/** Broadcast mixer / decks / pattern / playhead-adjacent state to other browsers on the same project. */
export function useProjectSync(projectId: string | undefined): void {
  const wsRef = useRef<WebSocket | null>(null);
  const applying = useRef(false);
  const clientId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`,
  );

  const bpm = useStudio((s) => s.bpm);
  const playing = useStudio((s) => s.playing);
  const crossfader = useStudio((s) => s.crossfader);
  const mode = useStudio((s) => s.mode);
  const sidechain = useStudio((s) => s.sidechain);
  const mixer = useStudio((s) => s.mixer);
  const keyLockA = useStudio((s) => s.keyLock.A);
  const keyLockB = useStudio((s) => s.keyLock.B);
  const deckA = useStudio((s) => s.deckFiles.A?.id ?? null);
  const deckB = useStudio((s) => s.deckFiles.B?.id ?? null);
  const drumSteps = useStudio((s) => s.drumSteps);
  const drumLength = useStudio((s) => s.drumLength);
  const drumSwing = useStudio((s) => s.drumSwing);
  const notes = useStudio((s) => s.notes);
  const clips = useStudio((s) => s.clips);
  const synth = useStudio((s) => s.synth);

  useEffect(() => {
    if (!projectId) return;
    const proto = WS || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;
    const socket = new WebSocket(`${proto}/ws/projects/${projectId}`);
    wsRef.current = socket;
    socket.onopen = () => {
      const s = useStudio.getState();
      socket.send(
        JSON.stringify({
          clientId: clientId.current,
          bpm: s.bpm,
          playing: s.playing,
          crossfader: s.crossfader,
          mode: s.mode,
          sidechain: s.sidechain,
          mixer: s.mixer,
          keyLock: s.keyLock,
          deckA: s.deckFiles.A?.id ?? null,
          deckB: s.deckFiles.B?.id ?? null,
          drumSteps: s.drumSteps,
          drumLength: s.drumLength,
          drumSwing: s.drumSwing,
          notes: s.notes,
          clips: s.clips,
          synth: s.synth,
        }),
      );
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const p = (msg.payload || msg) as Partial<CollabSnapshot> & { type?: string };
        if (!p || p.clientId === clientId.current || p.type === "hello" || !p.clientId) return;
        applying.current = true;
        void applySnapshot(p as CollabSnapshot).finally(() => {
          applying.current = false;
        });
      } catch {
        /* ignore */
      }
    };
    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    if (applying.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const handle = window.setTimeout(() => {
      if (applying.current || ws.readyState !== WebSocket.OPEN) return;
      const snap: CollabSnapshot = {
        clientId: clientId.current,
        bpm,
        playing,
        crossfader,
        mode,
        sidechain,
        mixer,
        keyLock: { A: keyLockA, B: keyLockB },
        deckA,
        deckB,
        drumSteps,
        drumLength,
        drumSwing,
        notes,
        clips,
        synth,
      };
      ws.send(JSON.stringify(snap));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [
    bpm,
    playing,
    crossfader,
    mode,
    sidechain,
    mixer,
    keyLockA,
    keyLockB,
    deckA,
    deckB,
    drumSteps,
    drumLength,
    drumSwing,
    notes,
    clips,
    synth,
  ]);
}

async function applySnapshot(p: CollabSnapshot): Promise<void> {
  const studio = useStudio.getState();
  const eng = getEngine();
  if (typeof p.bpm === "number" && p.bpm !== studio.bpm) studio.setBpm(p.bpm);
  if (typeof p.crossfader === "number") {
    eng.mixer.setCrossfader(p.crossfader);
    useStudio.setState({ crossfader: p.crossfader });
  }
  if (p.mode && p.mode !== studio.mode) studio.setMode(p.mode);
  if (typeof p.sidechain === "boolean") {
    eng.mixer.sidechain = p.sidechain;
    useStudio.setState({ sidechain: p.sidechain });
  }
  if (p.keyLock) {
    eng.decks.A.setKeyLock(!!p.keyLock.A);
    eng.decks.B.setKeyLock(!!p.keyLock.B);
    useStudio.setState({ keyLock: { A: !!p.keyLock.A, B: !!p.keyLock.B } });
  }
  if (p.mixer) {
    for (const [id, patch] of Object.entries(p.mixer)) {
      studio.applyMixerChannel(id, patch);
    }
  }
  if (p.drumSteps) {
    eng.drums.steps = p.drumSteps;
    eng.drums.length = p.drumLength || eng.drums.length;
    eng.drums.swing = p.drumSwing ?? eng.drums.swing;
    useStudio.setState({
      drumSteps: p.drumSteps,
      drumLength: p.drumLength || studio.drumLength,
      drumSwing: p.drumSwing ?? studio.drumSwing,
    });
  }
  if (p.notes) {
    eng.setNotes(p.notes);
    useStudio.setState({ notes: p.notes });
  }
  if (p.clips) {
    eng.timeline.clips = p.clips;
    useStudio.setState({ clips: p.clips });
  }
  if (p.synth) {
    eng.synth.setParams(p.synth);
    useStudio.setState({ synth: { ...studio.synth, ...p.synth } });
  }
  await studio.refreshLibrary();
  const lib = useStudio.getState().library;
  if (p.deckA && p.deckA !== (studio.deckFiles.A?.id ?? null)) {
    const file = lib.find((f) => f.id === p.deckA);
    if (file) await studio.loadToDeck("A", file);
  }
  if (p.deckB && p.deckB !== (studio.deckFiles.B?.id ?? null)) {
    const file = lib.find((f) => f.id === p.deckB);
    if (file) await studio.loadToDeck("B", file);
  }
  if (typeof p.playing === "boolean" && p.playing !== useStudio.getState().playing) {
    await studio.togglePlay();
  }
}
