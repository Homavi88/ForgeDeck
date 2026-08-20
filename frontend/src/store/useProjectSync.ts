import { useEffect, useRef } from "react";
import { getEngine } from "../audio-engine/AudioEngine";
import { getToken } from "../api/client";
import { currentUser } from "./auth";
import { useStudio } from "../store/useStudio";
import type { MixerStripState, MidiNote, MidiPattern, SessionClip, StudioMode, SynthParams, TimelineClip, DrumSteps } from "../types";

const WS = import.meta.env.VITE_WS_URL || "";

type CollabSnapshot = {
  type?: string;
  clientId: string;
  bpm: number;
  playing: boolean;
  crossfader: number;
  xfaderCurve?: "smooth" | "sharp" | "cut";
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
  midiPatterns?: MidiPattern[];
  activeMidiPatternId?: string;
  clips: TimelineClip[];
  sessionClips?: SessionClip[];
  synth: SynthParams;
  fxReturns?: { reverb: number; delay: number };
};

export type RoomPeer = { clientId: string; name: string; deck?: string | null };
export type RoomLock = { clientId: string; name: string };
export type RoomChat = { clientId: string; name: string; text: string; ts?: number };

let sendRoom: ((msg: Record<string, unknown>) => void) | null = null;
let myClientId = "";

export function getCollabId(): string {
  return myClientId;
}

export function collabName(): string {
  return currentUser()?.name || "Producer";
}

export function sendCollab(msg: Record<string, unknown>): void {
  sendRoom?.({ clientId: myClientId, name: collabName(), ...msg });
}

export function useProjectSync(projectId: string | undefined): void {
  const wsRef = useRef<WebSocket | null>(null);
  const applying = useRef(false);
  const clientId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`,
  );
  myClientId = clientId.current;

  const bpm = useStudio((s) => s.bpm);
  const playing = useStudio((s) => s.playing);
  const crossfader = useStudio((s) => s.crossfader);
  const xfaderCurve = useStudio((s) => s.xfaderCurve);
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
  const midiPatterns = useStudio((s) => s.midiPatterns);
  const activeMidiPatternId = useStudio((s) => s.activeMidiPatternId);
  const clips = useStudio((s) => s.clips);
  const sessionClips = useStudio((s) => s.sessionClips);
  const synth = useStudio((s) => s.synth);
  const fxReturns = useStudio((s) => s.fxReturns);

  useEffect(() => {
    if (!projectId) return;
    const proto = WS || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;
    const token = getToken();
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    const socket = new WebSocket(`${proto}/ws/projects/${projectId}${q}`);
    wsRef.current = socket;
    sendRoom = (msg) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    };
    socket.onopen = () => {
      const s = useStudio.getState();
      socket.send(
        JSON.stringify({
          type: "presence",
          clientId: clientId.current,
          name: collabName(),
          deck: s.deckFiles.A ? "A" : s.deckFiles.B ? "B" : null,
        }),
      );
      socket.send(
        JSON.stringify({
          type: "state",
          clientId: clientId.current,
          bpm: s.bpm,
          playing: s.playing,
          crossfader: s.crossfader,
          xfaderCurve: s.xfaderCurve,
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
          midiPatterns: s.midiPatterns,
          activeMidiPatternId: s.activeMidiPatternId,
          clips: s.clips,
          sessionClips: s.sessionClips,
          synth: s.synth,
          fxReturns: s.fxReturns,
        }),
      );
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "hello" || msg.type === "room") {
          useStudio.setState({
            peers: (msg.presence || []) as RoomPeer[],
            locks: (msg.locks || {}) as Record<string, RoomLock>,
            roomChat: msg.type === "hello" ? ((msg.chat || []) as RoomChat[]) : useStudio.getState().roomChat,
          });
          if (msg.type === "hello" && Array.isArray(msg.chat)) {
            useStudio.setState({ roomChat: msg.chat as RoomChat[] });
          }
          return;
        }
        if (msg.type === "chat" && msg.payload) {
          const line = msg.payload as RoomChat;
          if (line.clientId === clientId.current) return;
          useStudio.setState({ roomChat: [...useStudio.getState().roomChat, line].slice(-80) });
          return;
        }
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
      sendRoom = null;
    };
  }, [projectId]);

  useEffect(() => {
    if (applying.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const handle = window.setTimeout(() => {
      if (applying.current || ws.readyState !== WebSocket.OPEN) return;
      const snap: CollabSnapshot = {
        type: "state",
        clientId: clientId.current,
        bpm,
        playing,
        crossfader,
        xfaderCurve,
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
        midiPatterns,
        activeMidiPatternId,
        clips,
        sessionClips,
        synth,
        fxReturns,
      };
      ws.send(JSON.stringify(snap));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [
    bpm,
    playing,
    crossfader,
    xfaderCurve,
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
    midiPatterns,
    activeMidiPatternId,
    clips,
    sessionClips,
    synth,
    fxReturns,
  ]);

  useEffect(() => {
    if (applying.current) return;
    sendCollab({ type: "presence", deck: deckA ? "A" : deckB ? "B" : null });
  }, [deckA, deckB]);
}

async function applySnapshot(p: CollabSnapshot): Promise<void> {
  const studio = useStudio.getState();
  const eng = getEngine();
  const locks = studio.locks;
  const mine = getCollabId();
  if (typeof p.bpm === "number" && p.bpm !== studio.bpm) studio.setBpm(p.bpm);
  if (typeof p.crossfader === "number") {
    eng.mixer.setCrossfader(p.crossfader);
    useStudio.setState({ crossfader: p.crossfader });
  }
  if (p.xfaderCurve === "smooth" || p.xfaderCurve === "sharp" || p.xfaderCurve === "cut") {
    studio.setXfaderCurve(p.xfaderCurve);
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
  const drumsLockedByMe = locks.drums?.clientId === mine;
  if (p.drumSteps && !drumsLockedByMe) {
    eng.drums.steps = p.drumSteps;
    eng.drums.length = p.drumLength || eng.drums.length;
    eng.drums.swing = p.drumSwing ?? eng.drums.swing;
    useStudio.setState({
      drumSteps: p.drumSteps,
      drumLength: p.drumLength || studio.drumLength,
      drumSwing: p.drumSwing ?? studio.drumSwing,
    });
  }
  if (p.midiPatterns?.length) {
    const id = p.activeMidiPatternId || p.midiPatterns[0].id;
    const notes = p.midiPatterns.find((x) => x.id === id)?.notes || p.notes || [];
    eng.setNotes(notes);
    eng.piano.setLoopSteps(p.drumLength || studio.drumLength);
    useStudio.setState({ midiPatterns: p.midiPatterns, activeMidiPatternId: id, notes });
  } else if (p.notes) {
    useStudio.getState().writeNotes(p.notes);
  }
  if (p.clips) {
    eng.timeline.clips = p.clips;
    useStudio.setState({ clips: p.clips });
  }
  if (p.sessionClips) {
    eng.launcher.clips = p.sessionClips;
    useStudio.setState({ sessionClips: p.sessionClips });
  }
  if (p.fxReturns) {
    studio.setFxReturns(p.fxReturns);
  }
  if (p.synth) {
    eng.synth.setParams(p.synth);
    useStudio.setState({ synth: { ...studio.synth, ...p.synth } });
  }
  await studio.refreshLibrary();
  const lib = useStudio.getState().library;
  if (p.deckA && p.deckA !== (studio.deckFiles.A?.id ?? null) && locks.deckA?.clientId !== mine) {
    const file = lib.find((f) => f.id === p.deckA);
    if (file) await studio.loadToDeck("A", file);
  }
  if (p.deckB && p.deckB !== (studio.deckFiles.B?.id ?? null) && locks.deckB?.clientId !== mine) {
    const file = lib.find((f) => f.id === p.deckB);
    if (file) await studio.loadToDeck("B", file);
  }
  if (typeof p.playing === "boolean" && p.playing !== useStudio.getState().playing) {
    await studio.togglePlay();
  }
}
