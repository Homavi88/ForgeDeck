import { getEngine } from "../../audio-engine/AudioEngine";
import { ProductionMixer } from "../mix/ProductionMixer";
import { t, useI18n } from "../../i18n";
import { arrangeIdForMix, SESSION_SCENES, sessionLanes } from "../../lib/mix";
import { peekStemDrag, peekTrackDrag, readStemDrag, readTrackDragId } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";

export function SessionPanel() {
  const { sessionClips, bootAudio, sessionRec, prodLanes, selectedMixId } = useStudio();
  const clips = sessionClips.length ? sessionClips : getEngine().launcher.clips;
  useI18n((s) => s.locale);
  const lanes = sessionLanes(prodLanes);

  return (
    <div className="flex-1 p-4 overflow-auto flex flex-col gap-3 min-h-0">
      <div className="flex flex-wrap items-center gap-2">
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
        <button
          className="text-[10px] uppercase px-2 py-1 rounded bg-accent text-black font-semibold"
          onClick={() => useStudio.getState().addAudioLane()}
        >
          {t("arrange.addTrack")}
        </button>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: SESSION_SCENES }).map((_, scene) => (
          <button
            key={scene}
            className="text-[10px] uppercase bg-ink-700 px-2 py-1 rounded"
            onClick={() => {
              void bootAudio().then(() => {
                getEngine().launcher.queueScene(scene);
                const st = useStudio.getState();
                if (!st.playing) void st.togglePlay();
              });
            }}
          >
            {t("session.scene", { n: scene + 1 })}
          </button>
        ))}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "80px repeat(8, minmax(72px, 1fr))" }}>
        <div />
        {Array.from({ length: SESSION_SCENES }).map((_, i) => (
          <div key={i} className="text-[9px] uppercase text-zinc-600 text-center">
            {i + 1}
          </div>
        ))}
        {lanes.map((lane) => {
          const trackId = arrangeIdForMix(lane.id);
          const name =
            lane.id === "drums"
              ? t("session.drums")
              : lane.id === "synth"
                ? t("session.synth")
                : lane.id === "A"
                  ? t("session.deckA")
                  : lane.id === "B"
                    ? t("session.deckB")
                    : lane.name;
          return (
            <Row
              key={lane.id}
              trackId={trackId}
              mixId={lane.id}
              name={name}
              color={lane.color}
              selected={selectedMixId === lane.id}
              clips={clips}
            />
          );
        })}
      </div>
      <ProductionMixer />
    </div>
  );
}

function Row({
  trackId,
  mixId,
  name,
  color,
  selected,
  clips,
}: {
  trackId: string;
  mixId: string;
  name: string;
  color: string;
  selected: boolean;
  clips: ReturnType<typeof useStudio.getState>["sessionClips"];
}) {
  useI18n((s) => s.locale);
  const library = useStudio((s) => s.library);
  return (
    <>
      <button
        className={`text-xs self-center text-left truncate px-1 rounded ${selected ? "bg-ink-700" : ""}`}
        style={{ color }}
        onClick={() => useStudio.getState().selectMix(mixId)}
      >
        {name}
      </button>
      {Array.from({ length: SESSION_SCENES }).map((_, scene) => {
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
              useStudio.getState().selectMix(mixId);
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
