import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { PAD_IDS } from "../../audio-engine/DrumMachine";
import { sliceByOnsets } from "../../audio-engine/Sampler";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";
import { Waveform } from "../dj/Waveform";

export function SamplerPanel() {
  const { library, sampler, deckFiles, bootAudio } = useStudio();
  const file = library.find((f) => f.id === sampler.audioFileId) || deckFiles.A;
  useI18n((s) => s.locale);

  const load = async (id: string) => {
    await bootAudio();
    const buf = await getEngine().prefetch(id);
    getEngine().sampler.load(buf);
    useStudio.setState({
      sampler: { ...useStudio.getState().sampler, audioFileId: id, start: 0, end: buf.duration, reverse: false },
    });
  };

  const apply = () => {
    const s = useStudio.getState().sampler;
    const eng = getEngine().sampler;
    eng.start = s.start;
    eng.end = s.end;
    eng.reverse = s.reverse;
    eng.loop = s.loop;
    eng.playbackRate = s.playbackRate;
  };

  return (
    <div className="flex-1 p-4 overflow-auto flex flex-col gap-3">
      <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{t("sampler.title")}</div>
      <div className="flex flex-wrap gap-1">
        {library.map((f) => (
          <button key={f.id} className="text-xs bg-ink-700 px-2 py-1 rounded" onClick={() => void load(f.id)}>
            {f.original_filename}
          </button>
        ))}
      </div>
      {file && (
        <Waveform
          analysis={file.analysis}
          position={sampler.start}
          duration={file.analysis?.duration || 1}
          onSeek={(t) => useStudio.setState({ sampler: { ...sampler, start: t } })}
        />
      )}
      <div className="grid grid-cols-2 gap-3 max-w-xl text-[10px] uppercase text-zinc-500">
        <label>
          {t("sampler.start")} {sampler.start.toFixed(2)}s
          <input
            type="range"
            min={0}
            max={file?.analysis?.duration || 1}
            step={0.01}
            value={sampler.start}
            className="w-full"
            onChange={(e) => useStudio.setState({ sampler: { ...sampler, start: Number(e.target.value) } })}
          />
        </label>
        <label>
          {t("sampler.end")} {sampler.end.toFixed(2)}s
          <input
            type="range"
            min={0}
            max={file?.analysis?.duration || 1}
            step={0.01}
            value={sampler.end}
            className="w-full"
            onChange={(e) => useStudio.setState({ sampler: { ...sampler, end: Number(e.target.value) } })}
          />
        </label>
        <label>
          {t("sampler.pitch")} {sampler.playbackRate.toFixed(2)}x
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.01}
            value={sampler.playbackRate}
            className="w-full"
            onChange={(e) => useStudio.setState({ sampler: { ...sampler, playbackRate: Number(e.target.value) } })}
          />
        </label>
      </div>
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={sampler.reverse}
            onChange={(e) => useStudio.setState({ sampler: { ...sampler, reverse: e.target.checked } })}
          />
          {t("sampler.reverse")}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={sampler.loop}
            onChange={(e) => useStudio.setState({ sampler: { ...sampler, loop: e.target.checked } })}
          />
          {t("sampler.loop")}
        </label>
        <button
          className="bg-accent text-black px-3 py-1 rounded font-semibold"
          onClick={() => {
            apply();
            getEngine().sampler.trigger(1);
          }}
        >
          {t("sampler.preview")}
        </button>
        <button
          className="bg-ink-700 px-3 py-1 rounded"
          onClick={async () => {
            if (!file) return;
            apply();
            const onsets = file.analysis?.onsets?.length ? file.analysis.onsets : [0, sampler.end];
            const buf = getEngine().sampler.reversedBuffer();
            if (!buf) return;
            const slices = sliceByOnsets(buf, onsets.slice(0, 16));
            slices.forEach((sl, i) => getEngine().drums.assign(PAD_IDS[i], sl));
          }}
        >
          {t("sampler.slice")}
        </button>
        {file && (
          <button
            className="bg-ink-700 px-3 py-1 rounded"
            onClick={() => void api.audio.splitStems(file.id)}
          >
            {t("sampler.stems")}
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">{t("sampler.hint")}</p>
    </div>
  );
}
