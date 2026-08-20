import { getEngine } from "../../audio-engine/AudioEngine";
import { useStudio } from "../../store/useStudio";

const TRACKS = [
  { id: "drums", name: "Drums" },
  { id: "synth", name: "Synth" },
  { id: "deckA", name: "Deck A" },
  { id: "deckB", name: "Deck B" },
];

export function SessionPanel() {
  const { sessionClips, bootAudio } = useStudio();
  const clips = sessionClips.length ? sessionClips : getEngine().launcher.clips;

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-3">
        Clip launcher · click clip · scene buttons launch the row on the next bar
      </div>
      <div className="flex gap-2 mb-3">
        {Array.from({ length: 8 }).map((_, scene) => (
          <button
            key={scene}
            className="text-[10px] uppercase bg-ink-700 px-2 py-1 rounded"
            onClick={() => {
              void bootAudio().then(() => {
                getEngine().launcher.queueScene(scene);
                useStudio.getState().togglePlay();
              });
            }}
          >
            Scene {scene + 1}
          </button>
        ))}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "80px repeat(8, minmax(72px, 1fr))" }}>
        <div />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="text-[9px] uppercase text-zinc-600 text-center">
            {i + 1}
          </div>
        ))}
        {TRACKS.map((tr) => (
          <Row key={tr.id} trackId={tr.id} name={tr.name} clips={clips} />
        ))}
      </div>
    </div>
  );
}

function Row({
  trackId,
  name,
  clips,
}: {
  trackId: string;
  name: string;
  clips: ReturnType<typeof useStudio.getState>["sessionClips"];
}) {
  return (
    <>
      <div className="text-xs text-zinc-400 self-center">{name}</div>
      {Array.from({ length: 8 }).map((_, scene) => {
        const clip = clips.find((c) => c.trackId === trackId && c.scene === scene);
        const empty = clip?.empty ?? true;
        return (
          <button
            key={scene}
            className="h-12 rounded border border-line text-[10px] uppercase"
            style={{ background: empty ? "#141418" : clip?.color, color: empty ? "#888" : "#111" }}
            onClick={() => {
              void useStudio.getState().bootAudio().then(() => {
                const launched = getEngine().launch(trackId, scene);
                if (launched && !launched.empty && !useStudio.getState().playing) {
                  void useStudio.getState().togglePlay();
                }
              });
            }}
          >
            {empty ? "—" : clip?.name}
          </button>
        );
      })}
    </>
  );
}
