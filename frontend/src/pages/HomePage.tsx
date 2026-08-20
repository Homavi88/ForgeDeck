import { useEffect, useState } from "react";
import { Shell } from "../components/layout/Shell";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface RecentProject {
  id: string;
  name: string;
  bpm: number;
  updated_at?: string;
}

export default function HomePage() {
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    void api.projects
      .list()
      .then((items) => setRecent(items.slice(0, 6)))
      .catch(() => setRecent([]));
  }, []);

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-[10px] tracking-[0.4em] uppercase text-accent mb-4">Web DJ / DAW / Synth</p>
        <h1 className="text-5xl font-semibold tracking-tight mb-4">ForgeDeck</h1>
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
        {recent.length > 0 && (
          <div className="mt-12">
            <div className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">Recent projects</div>
            <div className="grid grid-cols-3 gap-3">
              {recent.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="p-4 rounded-lg border border-line bg-ink-800 hover:border-accent"
                >
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                    {p.bpm} BPM
                    {p.updated_at ? ` · ${p.updated_at.slice(0, 10)}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 mt-16 text-sm">
          {[
            ["DJ Decks", "Waveform, beatgrid, hot cues, loops, sync, pitch, PFL"],
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
