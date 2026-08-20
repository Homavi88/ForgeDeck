import { Shell } from "../components/layout/Shell";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-[10px] tracking-[0.4em] uppercase text-accent mb-4">Web DJ / DAW / Synth</p>
        <h1 className="text-5xl font-semibold tracking-tight mb-4">PulseForge</h1>
        <p className="text-zinc-400 max-w-2xl mb-10">
          Two DJ decks, a mixer, drum machine, subtractive synth and arrangement timeline in the browser.
          Python handles projects, analysis and AI. Web Audio handles the sound.
        </p>
        <div className="flex gap-3">
          <Link to="/projects" className="px-5 py-2.5 rounded bg-accent text-black font-semibold">
            Open studio
          </Link>
          <Link to="/library" className="px-5 py-2.5 rounded border border-line hover:bg-ink-800">
            Library
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-16 text-sm">
          {[
            ["DJ Decks", "Waveform, beatgrid, hot cues, loops, sync, pitch"],
            ["Production", "Step sequencer, synth, piano, timeline clips"],
            ["AI Producer", "Cues, transitions, drums, mix notes — preview then apply"],
          ].map(([t, d]) => (
            <div key={t} className="p-4 rounded-lg border border-line bg-ink-800">
              <div className="text-accent text-xs uppercase tracking-widest mb-2">{t}</div>
              <div className="text-zinc-400">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
