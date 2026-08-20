import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export default function SharePage() {
  const { token = "" } = useParams();
  const [meta, setMeta] = useState<{ name: string; bpm: number; musical_key: string; has_mix: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.share
      .get(token)
      .then(setMeta)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  return (
    <div className="min-h-full bg-ink-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-ink-900 border border-line rounded-xl p-6 space-y-4">
        <Link to="/" className="text-[10px] tracking-[0.3em] uppercase text-accent">
          ForgeDeck
        </Link>
        {error && <div className="text-danger text-sm">{error}</div>}
        {!error && !meta && <div className="text-zinc-500 text-sm">Loading share…</div>}
        {meta && (
          <>
            <h1 className="text-2xl font-semibold">{meta.name}</h1>
            <div className="text-sm text-zinc-400 font-mono">
              {meta.bpm} BPM · {meta.musical_key}
            </div>
            {meta.has_mix ? (
              <audio className="w-full" controls src={api.share.mixUrl(token)} />
            ) : (
              <p className="text-sm text-zinc-500">No bounced mix yet. Open the studio, hit Bounce or Rec, then share again.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
