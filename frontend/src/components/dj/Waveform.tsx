import { useEffect, useRef, useState } from "react";
import type { AudioAnalysis } from "../../types";

function drawWave(
  canvas: HTMLCanvasElement,
  analysis: AudioAnalysis | null | undefined,
  duration: number,
  color: string,
  position: number,
  windowStart = 0,
  windowEnd?: number,
) {
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

  const start = Math.max(0, windowStart);
  const end = Math.max(start + 0.05, windowEnd ?? duration);
  const span = end - start;
  const peaks = analysis?.waveform ?? [];
  const mid = h / 2;
  ctx.fillStyle = color;
  if (peaks.length && duration > 0) {
    const i0 = Math.floor((start / duration) * peaks.length);
    const i1 = Math.min(peaks.length, Math.ceil((end / duration) * peaks.length));
    const count = Math.max(1, i1 - i0);
    for (let i = i0; i < i1; i++) {
      const x = ((i - i0) / count) * w;
      const amp = peaks[i] * (h * 0.45);
      ctx.fillRect(x, mid - amp, Math.max(1, w / count), amp * 2);
    }
  }

  if (analysis?.beats && duration) {
    ctx.strokeStyle = "rgba(61,255,243,0.28)";
    ctx.lineWidth = 1;
    for (const beat of analysis.beats) {
      if (beat < start || beat > end) continue;
      const x = ((beat - start) / span) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  if (duration > 0 && position >= start && position <= end) {
    const x = ((position - start) / span) * w;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

export function Waveform({
  analysis,
  position,
  duration,
  onSeek,
  color = "#ff6a00",
  zoom: zoomProp,
  onZoomChange,
}: {
  analysis: AudioAnalysis | null | undefined;
  position: number;
  duration: number;
  onSeek: (t: number) => void;
  color?: string;
  zoom?: number;
  onZoomChange?: (z: number) => void;
}) {
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLCanvasElement>(null);
  const [zoomLocal, setZoomLocal] = useState(zoomProp ?? 1);
  const [viewStart, setViewStart] = useState(0);
  const zoom = zoomProp ?? zoomLocal;
  const setZoom = (z: number) => {
    setZoomLocal(z);
    onZoomChange?.(z);
  };
  useEffect(() => {
    if (zoomProp != null) setZoomLocal(zoomProp);
  }, [zoomProp]);
  const dur = Math.max(duration, 0.001);
  const windowLen = dur / zoom;
  const start = Math.min(viewStart, Math.max(0, dur - windowLen));
  const end = start + windowLen;

  useEffect(() => {
    if (position < start || position > end) {
      const next = Math.max(0, Math.min(dur - windowLen, position - windowLen * 0.35));
      if (Math.abs(next - viewStart) > 0.02) setViewStart(next);
    }
    // Follow playhead only when it leaves the window — avoid fighting manual scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, dur, zoom]);

  useEffect(() => {
    if (overviewRef.current) drawWave(overviewRef.current, analysis, dur, color, position);
    if (detailRef.current) drawWave(detailRef.current, analysis, dur, color, position, start, end);
  }, [analysis, position, dur, color, start, end]);

  const timeAt = (clientX: number, rect: DOMRect, a: number, b: number) =>
    a + ((clientX - rect.left) / Math.max(1, rect.width)) * (b - a);

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={overviewRef}
        className="w-full h-10 rounded bg-ink-950 cursor-pointer"
        title="Overview"
        onClick={(e) => {
          const t = timeAt(e.clientX, e.currentTarget.getBoundingClientRect(), 0, dur);
          setViewStart(Math.max(0, t - windowLen / 2));
          onSeek(t);
        }}
      />
      <canvas
        ref={detailRef}
        className="w-full h-24 rounded bg-ink-950 cursor-crosshair"
        title="Scroll to zoom · drag to pan"
        onWheel={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const at = timeAt(e.clientX, rect, start, end);
          const nextZoom = Math.min(24, Math.max(1, zoom * (e.deltaY > 0 ? 0.85 : 1.18)));
          const nextLen = dur / nextZoom;
          setZoom(nextZoom);
          setViewStart(Math.max(0, Math.min(dur - nextLen, at - nextLen * ((e.clientX - rect.left) / rect.width))));
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.shiftKey || e.button === 1) {
            const origin = start;
            const x0 = e.clientX;
            const move = (ev: MouseEvent) => {
              const dt = ((x0 - ev.clientX) / rect.width) * windowLen;
              setViewStart(Math.max(0, Math.min(dur - windowLen, origin + dt)));
            };
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
            return;
          }
          onSeek(timeAt(e.clientX, rect, start, end));
        }}
      />
      <div className="flex justify-between text-[9px] uppercase tracking-wider text-zinc-600">
        <span>Overview</span>
        <span>{zoom.toFixed(1)}× · wheel zoom · shift-drag pan</span>
      </div>
    </div>
  );
}
