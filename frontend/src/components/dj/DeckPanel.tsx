import { useState } from "react";
import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { peekTrackDrag, readTrackDragId, setStemDrag } from "../../lib/trackDrag";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio, type PitchRange } from "../../store/useStudio";
import { Platter } from "./Platter";
import { Waveform } from "./Waveform";

import type { StemName } from "../../types";

const STEMS: StemName[] = ["vocals", "drums", "bass", "other"];
const PITCH_CYCLE: PitchRange[] = [8, 16, 100];

function fmt(time: number): string {
  if (!Number.isFinite(time) || time < 0) time = 0;
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  const ms = Math.floor((time % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function DeckPanel({ side }: { side: "A" | "B" }) {
  const file = useStudio((s) => s.deckFiles[side]);
  const pos = useStudio((s) => s.deckPos[side]);
  const bpmMaster = useStudio((s) => s.bpm);
  const locked = useStudio((s) => s.keyLock[side]);
  const locks = useStudio((s) => s.locks);
  const stemMute = useStudio((s) => s.stemMute);
  const stemIso = useStudio((s) => s.stemIso[side]);
  const focused = useStudio((s) => s.focusDeck === side);
  const pfl = useStudio((s) => s.pfl[side]);
  const zoom = useStudio((s) => s.deckZoom[side]);
  const pitchRange = useStudio((s) => s.pitchRange[side]);
  const [over, setOver] = useState(false);
  useI18n((s) => s.locale);
  const pitch = getEngine().decks[side].pitch;
  const analysis = file?.analysis;
  const duration = analysis?.duration ?? getEngine().decks[side].duration;
  const remain = Math.max(0, duration - pos);
  const color = side === "A" ? "#ff6a00" : "#3dfff3";
  const deck = () => getEngine().decks[side];
  const lockKey = side === "A" ? "deckA" : "deckB";
  const lock = locks[lockKey];
  const blocked = !!lock && lock.clientId !== getCollabId();
  const mine = lock?.clientId === getCollabId();

  const dropTrack = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const id = readTrackDragId(e.dataTransfer);
    if (id) {
      const track = useStudio.getState().library.find((f) => f.id === id) || useStudio.getState().queue.find((f) => f.id === id);
      if (track) await useStudio.getState().loadToDeck(side, track);
      return;
    }
    if (e.dataTransfer.files.length) {
      await useStudio.getState().uploadFiles(e.dataTransfer.files);
      const name = e.dataTransfer.files[0]?.name;
      const fresh = useStudio.getState().library.find((f) => f.original_filename === name) || useStudio.getState().library[0];
      if (fresh) await useStudio.getState().loadToDeck(side, fresh);
    }
  };

  return (
    <section
      className={`flex-1 bg-ink-800 rounded-lg border p-3 flex flex-col gap-2 shadow-panel min-w-0 ${
        blocked ? "opacity-60" : ""
      } ${focused ? "border-accent ring-1 ring-accent/40" : "border-line"} ${over ? "bg-ink-700" : ""}`}
      onClick={() => useStudio.setState({ focusDeck: side })}
      onDragOver={(e) => {
        if (peekTrackDrag(e.dataTransfer) || e.dataTransfer.files.length) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => void dropTrack(e)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`text-xs tracking-[0.3em] uppercase ${focused ? "text-accent" : "text-zinc-500"}`}>
            {t("deck.deck", { side })}
            {focused ? t("deck.focus") : ""}
          </div>
          <button
            className={`text-[9px] uppercase px-2 py-0.5 rounded ${pfl ? "bg-mint text-black" : "bg-ink-700 text-zinc-400"}`}
            title={`${t("deck.pflTitle")} · ${t("deck.midiLearnHint")}`}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                void useStudio.getState().armDeckMidiLearn(`${side}.pfl`);
                return;
              }
              useStudio.getState().setPfl(side, !pfl);
            }}
          >
            {t("deck.pfl")}
          </button>
        </div>
        <div className="font-mono text-xs text-zinc-400">
          {analysis?.bpm?.toFixed(1) ?? "—"} BPM · {analysis?.key ?? "—"} {analysis?.camelot ? `· ${analysis.camelot}` : ""}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm truncate">{file?.original_filename ?? (over ? t("deck.dropLoad") : t("deck.empty"))}</div>
        <button
          className={`text-[9px] uppercase px-2 py-0.5 rounded ${mine ? "bg-accent text-black" : "bg-ink-700 text-zinc-400"}`}
          onClick={() => sendCollab({ type: mine ? "unlock" : "lock", resource: lockKey, name: collabName() })}
        >
          {blocked ? t("deck.lockedBy", { name: lock.name }) : mine ? t("deck.unlock") : t("deck.lock")}
        </button>
      </div>
      <div className="flex gap-3 items-start">
        <Platter side={side} />
        <div className="flex-1 min-w-0">
          <Waveform
            analysis={analysis}
            position={pos}
            duration={duration || 1}
            color={color}
            zoom={zoom}
            onZoomChange={(z) => useStudio.getState().setDeckZoom(side, z)}
            onSeek={(time) => deck().seek(time)}
          />
        </div>
      </div>
      <div className="flex justify-between font-mono text-lg">
        <span>{fmt(pos)}</span>
        <span className="text-zinc-500">-{fmt(remain)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Btn title={t("deck.midiLearnHint")} onClick={(e) => midiOr(e, `${side}.play`, () => deck().toggle())}>
          {t("deck.play")}
        </Btn>
        <Btn title={t("deck.midiLearnHint")} onClick={(e) => midiOr(e, `${side}.cue`, () => deck().cuePress())}>
          {t("deck.cue")}
        </Btn>
        <Btn onClick={() => deck().setCueHere()}>{t("deck.setCue")}</Btn>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <Btn
            key={n}
            title={t("deck.midiLearnHint")}
            onClick={(e) => midiOr(e, `${side}.hotcue.${n}`, () => deck().jumpHotcue(n))}
          >
            H{n}
          </Btn>
        ))}
        <Btn onClick={() => useStudio.getState().nudgeBeatgrid(side, -10)} title={t("deck.gridNudge")}>
          {t("deck.gridLeft")}
        </Btn>
        <Btn onClick={() => useStudio.getState().nudgeBeatgrid(side, 10)} title={t("deck.gridNudge")}>
          {t("deck.gridRight")}
        </Btn>
        {[1, 2, 4, 8, 16].map((bars) => (
          <Btn
            key={bars}
            title={t("deck.midiLearnHint")}
            onClick={(e) => midiOr(e, `${side}.loop.${bars}`, () => deck().loopBars(bars, analysis?.bpm || bpmMaster))}
          >
            {bars}
          </Btn>
        ))}
        <Btn title={t("deck.midiLearnHint")} onClick={(e) => midiOr(e, `${side}.loop.off`, () => deck().clearLoop())}>
          {t("deck.loopOff")}
        </Btn>
        <Btn onClick={() => deck().markLoopIn()}>{t("deck.in")}</Btn>
        <Btn onClick={() => deck().markLoopOut()}>{t("deck.out")}</Btn>
        <Btn onClick={() => deck().beatJump(-4, analysis?.bpm || bpmMaster)}>-4</Btn>
        <Btn onClick={() => deck().beatJump(4, analysis?.bpm || bpmMaster)}>+4</Btn>
        {[1, 2, 4, 8].map((beats) => (
          <Btn
            key={`roll-${beats}`}
            onMouseDown={() => deck().loopRollStart(beats, analysis?.bpm || bpmMaster)}
            onMouseUp={() => deck().loopRollEnd()}
            onMouseLeave={() => deck().loopRollEnd()}
          >
            {t("deck.roll", { n: beats })}
          </Btn>
        ))}
        <Btn
          onClick={() => {
            const other = side === "A" ? "B" : "A";
            const otherFile = useStudio.getState().deckFiles[other];
            const masterBpm = otherFile?.analysis?.bpm || bpmMaster;
            if (analysis?.bpm) deck().syncToBpm(analysis.bpm, masterBpm);
          }}
        >
          {t("deck.sync")}
        </Btn>
        <Btn onClick={() => void useStudio.getState().instantDouble(side)}>{t("deck.double")}</Btn>
        <Btn onClick={() => useStudio.getState().matchGain(side)}>{t("deck.matchGain")}</Btn>
        <Btn onClick={() => useStudio.getState().quantizeSync(side)}>{t("deck.qSync")}</Btn>
        <Btn onClick={() => useStudio.getState().echoOut(side)}>{t("deck.echoOut")}</Btn>
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] uppercase text-zinc-500">
        <label className="flex items-center gap-1" title={t("deck.midiLearnHint")}>
          <input
            type="checkbox"
            checked={locked}
            onClick={(e) => {
              if (!e.shiftKey) return;
              e.preventDefault();
              void useStudio.getState().armDeckMidiLearn(`${side}.keylock`);
            }}
            onChange={(e) => useStudio.getState().setKeyLock(side, e.target.checked)}
          />
          {t("deck.keyLock")}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            defaultChecked
            onChange={(e) => {
              deck().quantize = e.target.checked;
            }}
          />
          {t("deck.quantize")}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            onChange={(e) => {
              deck().slip = e.target.checked;
            }}
          />
          {t("deck.slip")}
        </label>
      </div>
      <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        {t("deck.pitch")} {pitch.toFixed(1)}%
        <button
          type="button"
          className="px-1.5 py-0.5 rounded bg-ink-700 text-zinc-300"
          title={t("deck.pitchRange")}
          onClick={() => {
            const i = PITCH_CYCLE.indexOf(pitchRange);
            const next = PITCH_CYCLE[(i + 1) % PITCH_CYCLE.length];
            useStudio.getState().setPitchRange(side, next);
          }}
        >
          ±{pitchRange}
        </button>
        <input
          type="range"
          min={-pitchRange}
          max={pitchRange}
          step={pitchRange === 100 ? 0.5 : 0.1}
          className="flex-1"
          value={Math.max(-pitchRange, Math.min(pitchRange, pitch))}
          disabled={blocked}
          onChange={(e) => {
            deck().setPitch(Number(e.target.value));
          }}
        />
      </label>
      {file && (
        <StemRack side={side} fileId={file.id} stems={analysis?.stems} stemMute={stemMute} stemIso={stemIso} />
      )}
    </section>
  );
}

function StemRack({
  side,
  fileId,
  stems,
  stemMute,
  stemIso,
}: {
  side: "A" | "B";
  fileId: string;
  stems?: Record<string, string>;
  stemMute: Record<string, boolean>;
  stemIso: string | null;
}) {
  const names = STEMS.filter((s) => stems?.[s]);
  useI18n((s) => s.locale);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase text-zinc-500">
      <button
        className="px-2 py-1 bg-ink-700 rounded text-zinc-300"
        onClick={async () => {
          const st = useStudio.getState();
          st.pushToast({ id: `stems-${fileId}`, kind: "info", text: t("deck.splitting"), ttl: 0 });
          try {
            await api.audio.splitStems(fileId);
            await st.refreshLibrary();
            const fresh = useStudio.getState().library.find((f) => f.id === fileId);
            if (fresh) {
              const decks = useStudio.getState().deckFiles;
              const loadedSide = decks.A?.id === fileId ? "A" : decks.B?.id === fileId ? "B" : side;
              useStudio.setState({ deckFiles: { ...decks, [loadedSide]: fresh } });
            }
            const map = fresh?.analysis?.stems || {};
            const loaded = STEMS.filter((s) => map[s]);
            if (loaded.length) await getEngine().loadStems(side, fileId, [...loaded]);
            useStudio.setState({ error: null });
            st.dismissToast(`stems-${fileId}`);
            const engine = (fresh?.analysis as { engine?: string } | undefined)?.engine;
            st.pushToast({
              id: `stems-${fileId}`,
              kind: "ok",
              text: loaded.length
                ? t("deck.stemsReady", { engine: engine ? ` (${engine})` : "" })
                : t("deck.stemsNone"),
              ttl: 4000,
            });
          } catch (err) {
            st.dismissToast(`stems-${fileId}`);
            const msg = err instanceof Error ? err.message : t("toast.stemFail");
            useStudio.setState({ error: msg });
            st.pushToast({ id: `stems-${fileId}`, kind: "err", text: msg, ttl: 5000 });
          }
        }}
      >
        {names.length ? t("deck.reloadStems") : t("deck.splitStems")}
      </button>
      {names.map((name) => (
        <div
          key={name}
          draggable
          onDragStart={(e) => setStemDrag(e.dataTransfer, { audioFileId: fileId, stem: name })}
          className="flex items-center gap-1 cursor-grab"
          title={t("deck.stemDrag")}
        >
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!stemMute[name]}
              onChange={(e) => {
                const muted = !e.target.checked;
                getEngine().setStemMute(name, muted);
                useStudio.setState({ stemMute: { ...useStudio.getState().stemMute, [name]: muted } });
              }}
            />
            {name}
          </label>
          <button
            className={`text-[8px] px-1 rounded ${stemIso === name ? "bg-accent text-black" : "bg-ink-700"}`}
            title={t("deck.stemIso")}
            onClick={() => {
              getEngine().setStemIso(side, name, useStudio.getState().stemMute);
              useStudio.setState({
                stemIso: { ...useStudio.getState().stemIso, [side]: getEngine().stemIso[side] },
              });
            }}
          >
            ISO
          </button>
        </div>
      ))}
    </div>
  );
}

function midiOr(e: React.MouseEvent, target: string, action: () => void): void {
  if (e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    void useStudio.getState().armDeckMidiLearn(target);
    return;
  }
  action();
}

function Btn({
  children,
  title,
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      className="px-2 py-1 text-[10px] uppercase tracking-wider bg-ink-700 rounded hover:bg-ink-600"
    >
      {children}
    </button>
  );
}
