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
    const wire = () => {
      const dest = eng.mixer.headphoneDest;
      if (!dest) return;
      if (el.srcObject !== dest.stream) el.srcObject = dest.stream;
      void el.play().catch(() => undefined);
    };
    wire();
    const id = window.setInterval(wire, 2000);
    return () => window.clearInterval(id);
  }, []);

  return <audio ref={ref} autoPlay playsInline className="absolute w-px h-px opacity-0 pointer-events-none" />;
}
