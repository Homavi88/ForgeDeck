import { Shell } from "../components/layout/Shell";

export default function SettingsPage() {
  return (
    <Shell>
      <div className="max-w-xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-zinc-400 text-sm">
          MVP uses a demo user (no login UI). Configure API keys for a real LLM in{" "}
          <code className="text-accent">.env</code> — <code>AI_PROVIDER</code>, <code>OPENAI_API_KEY</code>, etc.
          Playback always runs in the browser via Web Audio / AudioWorklet.
        </p>
        <ul className="text-sm text-zinc-500 list-disc pl-5 space-y-1">
          <li>Backend docs: http://localhost:8000/docs</li>
          <li>Health: http://localhost:8000/api/health</li>
          <li>Stem separation (Demucs) is stubbed — see TODO.md</li>
          <li>Key lock / independent timestretch is stubbed</li>
        </ul>
      </div>
    </Shell>
  );
}
