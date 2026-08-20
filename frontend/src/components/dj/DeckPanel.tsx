import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio } from "../../store/useStudio";
import { Platter } from "./Platter";
import { Waveform } from "./Waveform";

const STEMS = ["vocals", "drums", "bass", "other"] as const;

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function DeckPanel({ side }: { side: "A" | "B" }) {
  const file = useStudio((s) => s.deckFiles[side]);
  const pos = useStudio((s) => s.deckPos[side]);
  const bpmMaster = useStudio((s) => s.bpm);
  const locked = useStudio((s) => s.keyLock[side]);
  const locks = useStudio((s) => s.locks);
  const stemMute = useStudio((s) => s.stemMute);
  const analysis = file?.analysis;
  const duration = analysis?.duration ?? getEngine().decks[side].duration;
  const remain = Math.max(0, duration - pos);
  const color = side === "A" ? "#ff6a00" : "#3dfff3";
  const deck = () => getEngine().decks[side];
  const lockKey = side === "A" ? "deckA" : "deckB";
  const lock = locks[lockKey];
  const blocked = !!lock && lock.clientId !== getCollabId();
  const mine = lock?.clientId === getCollabId();

  return (
    <section className={`flex-1 bg-ink-800 rounded-lg border border-line p-3 flex flex-col gap-2 shadow-panel min-w-0 ${blocked ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-[0.3em] uppercase text-zinc-500">Deck {side}</div>
        <div className="font-mono text-xs text-zinc-400">
          {analysis?.bpm?.toFixed(1) ?? "—"} BPM · {analysis?.key ?? "—"} {analysis?.camelot ? `· ${analysis.camelot}` : ""}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm truncate">{file?.original_filename ?? "Empty — drop a track"}</div>
        <button
          className={`text-[9px] uppercase px-2 py-0.5 rounded ${mine ? "bg-accent text-black" : "bg-ink-700 text-zinc-400"}`}
          onClick={() => sendCollab({ type: mine ? "unlock" : "lock", resource: lockKey, name: collabName() })}
        >
          {blocked ? `Locked by ${lock.name}` : mine ? "Unlock" : "Lock"}
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
            onSeek={(t) => deck().seek(t)}
          />
        </div>
      </div>
      <div className="flex justify-between font-mono text-lg">
        <span>{fmt(pos)}</span>
        <span className="text-zinc-500">-{fmt(remain)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Btn onClick={() => deck().toggle()}>Play</Btn>
        <Btn onClick={() => deck().cuePress()}>Cue</Btn>
        <Btn onClick={() => deck().setCueHere()}>Set Cue</Btn>
        {[1, 2, 3, 4].map((n) => (
          <Btn key={n} onClick={() => deck().jumpHotcue(n)}>
            H{n}
          </Btn>
        ))}
        {[1, 2, 4, 8, 16].map((bars) => (
          <Btn key={bars} onClick={() => deck().loopBars(bars, analysis?.bpm || bpmMaster)}>
            {bars}
          </Btn>
        ))}
        <Btn onClick={() => deck().clearLoop()}>Loop off</Btn>
        <Btn onClick={() => deck().markLoopIn()}>In</Btn>
        <Btn onClick={() => deck().markLoopOut()}>Out</Btn>
        <Btn onClick={() => deck().beatJump(-4, analysis?.bpm || bpmMaster)}>-4</Btn>
        <Btn onClick={() => deck().beatJump(4, analysis?.bpm || bpmMaster)}>+4</Btn>
        {[1, 2, 4, 8].map((beats) => (
          <Btn
            key={`roll-${beats}`}
            onMouseDown={() => deck().loopRollStart(beats, analysis?.bpm || bpmMaster)}
            onMouseUp={() => deck().loopRollEnd()}
            onMouseLeave={() => deck().loopRollEnd()}
          >
            Roll {beats}
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
          Sync
        </Btn>
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] uppercase text-zinc-500">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => {
              deck().setKeyLock(e.target.checked);
              useStudio.setState({ keyLock: { ...useStudio.getState().keyLock, [side]: e.target.checked } });
            }}
          />
          Key lock
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            defaultChecked
            onChange={(e) => {
              deck().quantize = e.target.checked;
            }}
          />
          Quantize
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            onChange={(e) => {
              deck().slip = e.target.checked;
            }}
          />
          Slip
        </label>
      </div>
      <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        Pitch {deck().pitch.toFixed(1)}%
        <input
          type="range"
          min={-8}
          max={8}
          step={0.1}
          className="flex-1"
          defaultValue={0}
          disabled={blocked}
          onChange={(e) => {
            deck().setPitch(Number(e.target.value));
          }}
        />
      </label>
      {file && <StemRack side={side} fileId={file.id} stems={analysis?.stems} stemMute={stemMute} />}
    </section>
  );
}

function StemRack({
  side,
  fileId,
  stems,
  stemMute,
}: {
  side: "A" | "B";
  fileId: string;
  stems?: Record<string, string>;
  stemMute: Record<string, boolean>;
}) {
  const names = STEMS.filter((s) => stems?.[s]);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase text-zinc-500">
      <button
        className="px-2 py-1 bg-ink-700 rounded text-zinc-300"
        onClick={async () => {
          try {
            await api.audio.splitStems(fileId);
            await useStudio.getState().refreshLibrary();
            const fresh = useStudio.getState().library.find((f) => f.id === fileId);
            if (fresh) {
              const decks = useStudio.getState().deckFiles;
              const side = decks.A?.id === fileId ? "A" : decks.B?.id === fileId ? "B" : "A";
              useStudio.setState({ deckFiles: { ...decks, [side]: fresh } });
            }
            const map = fresh?.analysis?.stems || {};
            const loaded = STEMS.filter((s) => map[s]);
            if (loaded.length) await getEngine().loadStems(side, fileId, [...loaded]);
            useStudio.setState({ error: null });
          } catch (err) {
            useStudio.setState({ error: err instanceof Error ? err.message : "Stem split failed" });
          }
        }}
      >
        {names.length ? "Reload stems" : "Split stems"}
      </button>
      {names.map((name) => (
        <label key={name} className="flex items-center gap-1">
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
      ))}
    </div>
  );
}

function Btn({
  children,
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
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
