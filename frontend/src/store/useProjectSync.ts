import { useEffect, useRef } from "react";
import { useStudio } from "../store/useStudio";

const WS = import.meta.env.VITE_WS_URL || "";

/** Broadcast BPM / play / crossfader to other browsers on the same project. */
export function useProjectSync(projectId: string | undefined): void {
  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`,
  );
  const bpm = useStudio((s) => s.bpm);
  const playing = useStudio((s) => s.playing);
  const crossfader = useStudio((s) => s.crossfader);

  useEffect(() => {
    if (!projectId) return;
    const proto = WS || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;
    const socket = new WebSocket(`${proto}/ws/projects/${projectId}`);
    wsRef.current = socket;
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const p = msg.payload || msg;
        if (!p || p.clientId === clientId.current) return;
        if (typeof p.bpm === "number") useStudio.getState().setBpm(p.bpm);
        if (typeof p.crossfader === "number") {
          useStudio.setState({ crossfader: p.crossfader });
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ bpm, playing, crossfader, clientId: clientId.current }));
  }, [bpm, playing, crossfader]);
}
