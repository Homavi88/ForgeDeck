import type { SessionClip } from "../types";

/** Ableton-style clip launcher: 8 scenes × tracks. Launch is quantized by the transport. */
export class ClipLauncher {
  scenes = 8;
  clips: SessionClip[] = [];
  active: Record<string, SessionClip | null> = { drums: null, synth: null, deckA: null, deckB: null };
  pendingScene: number | null = null;

  constructor() {
    this.clips = defaultSession();
  }

  clipAt(trackId: string, scene: number): SessionClip | undefined {
    return this.clips.find((c) => c.trackId === trackId && c.scene === scene);
  }

  launchClip(trackId: string, scene: number): SessionClip | null {
    const clip = this.clipAt(trackId, scene) ?? null;
    this.active[trackId] = clip;
    return clip;
  }

  queueScene(scene: number): void {
    this.pendingScene = scene;
  }

  onBar(bar: number): void {
    if (this.pendingScene == null) return;
    if (bar % 1 !== 0) return;
    const scene = this.pendingScene;
    this.pendingScene = null;
    for (const track of ["drums", "synth", "deckA", "deckB"]) {
      this.launchClip(track, scene);
    }
  }
}

function defaultSession(): SessionClip[] {
  const tracks = ["drums", "synth", "deckA", "deckB"] as const;
  const names = ["Intro", "Groove", "Drop", "Break", "Drop 2", "Fill", "Outro", "Loop"];
  const colors = ["#3dfff3", "#ff6a00", "#3dff7a", "#ffd23f", "#ff6a00", "#c084fc", "#64748b", "#fb7185"];
  const clips: SessionClip[] = [];
  tracks.forEach((trackId) => {
    names.forEach((name, scene) => {
      clips.push({
        id: `${trackId}-${scene}`,
        trackId,
        scene,
        name: scene === 0 && trackId === "drums" ? "Kit" : name,
        kind: trackId === "synth" ? "midi" : trackId === "drums" ? "drums" : "audio",
        lengthBars: scene % 2 === 0 ? 8 : 4,
        color: colors[scene],
        empty: !(trackId === "drums" && scene === 0) && !(trackId === "synth" && scene === 1),
      });
    });
  });
  // Default filled slots: drums scene 0 + 2, synth scene 1 + 2
  const fill = clips.find((c) => c.trackId === "drums" && c.scene === 2);
  if (fill) fill.empty = false;
  const syn = clips.find((c) => c.trackId === "synth" && c.scene === 1);
  if (syn) syn.empty = false;
  const syn2 = clips.find((c) => c.trackId === "synth" && c.scene === 2);
  if (syn2) syn2.empty = false;
  return clips;
}
