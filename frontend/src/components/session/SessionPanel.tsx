import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { peekStemDrag, peekTrackDrag, readStemDrag, readTrackDragId } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";

export function SessionPanel() {
  const { sessionClips, bootAudio, sessionRec } = useStudio();
  const clips = sessionClips.length ? sessionClips : getEngine().launcher.clips;
  useI18n((s) => s.locale);
  const TRACKS = [
    { id: "drums", name: t("session.drums") },
    { id: "synth", name: t("session.synth") },
    { id: "deckA", name: t("session.deckA") },
    { id: "deckB", name: t("session.deckB") },
  ];

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{t("session.hint")}</div>
        <button
          className={`text-[10px] uppercase px-2 py-1 rounded ${sessionRec ? "bg-danger text-white" : "bg-ink-700"}`}
          onClick={() => void useStudio.getState().toggleSessionRec()}
        >
          {sessionRec ? t("session.recOn") : t("session.rec")}
        </button>
        <button
          className="text-[10px] uppercase px-2 py-1 rounded bg-ink-700"
          onClick={() => useStudio.getState().captureSceneNow()}
        >
          {t("session.capture")}
        </button>
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
            {t("session.scene", { n: scene + 1 })}
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
  useI18n((s) => s.locale);
  const library = useStudio((s) => s.library);
  return (
    <>
      <div className="text-xs text-zinc-400 self-center">{name}</div>
      {Array.from({ length: 8 }).map((_, scene) => {
        const clip = clips.find((c) => c.trackId === trackId && c.scene === scene);
        const empty = clip?.empty ?? true;
        const file = clip?.audioFileId ? library.find((f) => f.id === clip.audioFileId) : undefined;
        const bpm = clip?.sourceBpm ?? file?.analysis?.bpm;
        const key = clip?.sourceKey ?? file?.analysis?.key;
        return (
          <button
            key={scene}
            className="h-14 rounded border border-line text-[10px] uppercase flex flex-col items-center justify-center px-1"
            style={{ background: empty ? "#141418" : clip?.color, color: empty ? "#888" : "#111" }}
            onDragOver={(e) => {
              if (peekTrackDrag(e.dataTransfer) || peekStemDrag(e.dataTransfer)) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const stem = readStemDrag(e.dataTransfer);
              if (stem) {
                const f = library.find((x) => x.id === stem.audioFileId);
                if (f) useStudio.getState().placeLoopOnSession(trackId, scene, f, stem.stem);
                return;
              }
              const id = readTrackDragId(e.dataTransfer);
              const f = id ? library.find((x) => x.id === id) : null;
              if (f) useStudio.getState().placeLoopOnSession(trackId, scene, f);
            }}
            onClick={() => {
              void useStudio.getState().bootAudio().then(() => {
                const launched = getEngine().launch(trackId, scene);
                if (launched && !launched.empty && !useStudio.getState().playing) {
                  void useStudio.getState().togglePlay();
                }
              });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (clip && !empty && clip.kind === "audio") {
                useStudio.getState().toggleClipKeyFollow(clip.id, "session");
              }
            }}
          >
            <span className="truncate w-full text-center">{empty ? "—" : clip?.name}</span>
            {!empty && clip?.kind === "audio" && (
              <span className="font-mono text-[8px] opacity-80">
                {bpm ? Math.round(bpm) : "—"} {key ? String(key).split(" ")[0] : ""}
                {clip.keyFollow ? " K" : ""}
                {clip.stem ? ` ${clip.stem}` : ""}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
