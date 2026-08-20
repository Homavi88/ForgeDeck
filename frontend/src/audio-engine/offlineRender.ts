/** Mix loaded deck buffers through OfflineAudioContext — closest to "what you hear". */
import { getEngine } from "./AudioEngine";

export async function renderOfflineWav(): Promise<Blob> {
  const eng = getEngine();
  const a = eng.decks.A.buffer;
  const b = eng.decks.B.buffer;
  if (!a && !b) throw new Error("Load a track to a deck first");
  const sr = a?.sampleRate || b!.sampleRate;
  const len = Math.max(a?.length || 0, b?.length || 0);
  const offline = new OfflineAudioContext(2, len, sr);
  const master = offline.createGain();
  master.gain.value = eng.mixer.master.volume.gain.value;
  master.connect(offline.destination);
  if (a) {
    const src = offline.createBufferSource();
    src.buffer = a;
    const g = offline.createGain();
    g.gain.value = eng.mixer.channels.A.volume.gain.value * (1 - eng.mixer.crossfader * 0.5);
    src.connect(g).connect(master);
    src.start(0);
  }
  if (b) {
    const src = offline.createBufferSource();
    src.buffer = b;
    const g = offline.createGain();
    g.gain.value = eng.mixer.channels.B.volume.gain.value * (0.5 + eng.mixer.crossfader * 0.5);
    src.connect(g).connect(master);
    src.start(0);
  }
  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const length = buffer.length * ch * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length - 44, true);
  let offset = 44;
  const channels = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}
