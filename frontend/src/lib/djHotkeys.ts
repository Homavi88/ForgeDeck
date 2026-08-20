import { getEngine } from "../audio-engine/AudioEngine";
import { useStudio } from "../store/useStudio";

export const DJ_KEYMAP = [
  ["A / B", "Focus deck"],
  ["Space", "Play / pause both"],
  ["Shift+Space", "Play / pause focused"],
  ["C", "Cue"],
  ["Shift+C", "Set cue here"],
  ["1–4", "Hotcue (set if empty)"],
  ["Q W E R", "Loop 1 / 2 / 4 / 8 bars"],
  ["Shift+Q", "Loop off"],
  [", / .", "Beat jump −4 / +4"],
  ["N / Shift+N", "Load next / prev from crate"],
  ["Y", "Sync focused to the other deck"],
  ["K", "Key lock"],
  ["F", "PFL / headphones on focused"],
  ["T", "Tap tempo"],
  ["?", "This map"],
] as const;

function typing(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function deckBpm(side: "A" | "B"): number {
  const s = useStudio.getState();
  return s.deckFiles[side]?.analysis?.bpm || s.bpm;
}

function focused() {
  return useStudio.getState().focusDeck;
}

export function handleDjHotkey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey) return false;
  if (typing(e.target)) return false;
  const s = useStudio.getState();
  if (s.mode !== "dj") return false;

  const key = e.key;
  const code = e.code;
  const side = focused();
  const eng = getEngine();
  const deck = eng.decks[side];
  const bpm = deckBpm(side);

  const playFocused = () => {
    if (!deck.buffer) return;
    deck.toggle();
    useStudio.setState({ playing: eng.decks.A.playing || eng.decks.B.playing });
  };

  if (e.code === "Space") {
    e.preventDefault();
    if (e.shiftKey) playFocused();
    else void s.togglePlay();
    return true;
  }

  if (key === "?" || (e.shiftKey && key === "/")) {
    e.preventDefault();
    useStudio.setState({ keymapOpen: !s.keymapOpen });
    return true;
  }

  const lower = key.toLowerCase();

  if (lower === "a") {
    e.preventDefault();
    useStudio.setState({ focusDeck: "A" });
    return true;
  }
  if (lower === "b") {
    e.preventDefault();
    useStudio.setState({ focusDeck: "B" });
    return true;
  }
  if (lower === "c") {
    e.preventDefault();
    if (e.shiftKey) deck.setCueHere();
    else deck.cuePress();
    return true;
  }
  if (lower === "q") {
    e.preventDefault();
    if (e.shiftKey) deck.clearLoop();
    else deck.loopBars(1, bpm);
    return true;
  }
  if (lower === "w") {
    e.preventDefault();
    deck.loopBars(2, bpm);
    return true;
  }
  if (lower === "e") {
    e.preventDefault();
    deck.loopBars(4, bpm);
    return true;
  }
  if (lower === "r") {
    e.preventDefault();
    deck.loopBars(8, bpm);
    return true;
  }
  if (key === "," || code === "Comma") {
    e.preventDefault();
    deck.beatJump(-4, bpm);
    return true;
  }
  if (key === "." || code === "Period") {
    e.preventDefault();
    deck.beatJump(4, bpm);
    return true;
  }
  if (lower === "n") {
    e.preventDefault();
    void useStudio.getState().loadCrateToFocused(e.shiftKey ? -1 : 1);
    return true;
  }
  if (lower === "y") {
    e.preventDefault();
    const other = side === "A" ? "B" : "A";
    const trackBpm = s.deckFiles[side]?.analysis?.bpm;
    const masterBpm = s.deckFiles[other]?.analysis?.bpm || s.bpm;
    if (trackBpm) deck.syncToBpm(trackBpm, masterBpm);
    return true;
  }
  if (lower === "k") {
    e.preventDefault();
    const next = !s.keyLock[side];
    deck.setKeyLock(next);
    s.setKeyLock(side, next);
    return true;
  }
  if (lower === "f") {
    e.preventDefault();
    s.setPfl(side, !s.pfl[side]);
    return true;
  }
  if (lower === "t") {
    e.preventDefault();
    s.tapTempo();
    return true;
  }

  const digit = code.match(/^Digit([1-4])$/);
  if (digit) {
    e.preventDefault();
    deck.jumpHotcue(Number(digit[1]));
    return true;
  }

  return false;
}
