import { useEffect, useRef } from "react";
import { getEngine } from "../../audio-engine/AudioEngine";

/** Hidden <audio> that plays the mixer headphone bus (second output via setSinkId). */
export function HeadphonesMonitor() {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const eng = getEngine();
    eng.attachHeadphonesEl(el);
    const id = window.setInterval(() => eng.keepHeadphonesAlive(), 2000);
    return () => window.clearInterval(id);
  }, []);

  return <audio ref={ref} autoPlay playsInline className="absolute w-px h-px opacity-0 pointer-events-none" />;
}
