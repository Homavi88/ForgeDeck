import { useEffect, useRef } from "react";
import type { AudioAnalysis } from "../../types";

export function Waveform({
  analysis,
  position,
  duration,
  onSeek,
  color = "#ff6a00",
}: {
  analysis: AudioAnalysis | null | undefined;
  position: number;
  duration: number;
  onSeek: (t: number) => void;
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#101014";
    ctx.fillRect(0, 0, w, h);

    const peaks = analysis?.waveform ?? [];
    const mid = h / 2;
    ctx.fillStyle = color;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const amp = peaks[i] * (h * 0.45);
      ctx.fillRect(x, mid - amp, Math.max(1, w / peaks.length), amp * 2);
    }

    if (analysis?.beats && duration) {
      ctx.strokeStyle = "rgba(61,255,243,0.25)";
      ctx.lineWidth = 1;
      for (const beat of analysis.beats) {
        const x = (beat / duration) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    if (duration > 0) {
      const x = (position / duration) * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }, [analysis, position, duration, color]);

  return (
    <canvas
      ref={ref}
      className="w-full h-24 rounded bg-ink-950 cursor-crosshair"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const t = ((e.clientX - rect.left) / rect.width) * duration;
        onSeek(t);
      }}
    />
  );
}
