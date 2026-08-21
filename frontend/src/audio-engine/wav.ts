/** PCM WAV encode / simple resample for offline bounce. */

export type WavBitDepth = 16 | 24;

export function resampleBuffer(src: AudioBuffer, ctx: BaseAudioContext, targetRate: number): AudioBuffer {
  const rate = targetRate > 0 ? targetRate : src.sampleRate;
  if (Math.abs(src.sampleRate - rate) < 0.5) {
    const copy = ctx.createBuffer(src.numberOfChannels, src.length, ctx.sampleRate);
    for (let c = 0; c < src.numberOfChannels; c++) copy.getChannelData(c).set(src.getChannelData(c));
    return copy;
  }
  const ratio = rate / src.sampleRate;
  const newLen = Math.max(1, Math.round(src.length * ratio));
  const out = ctx.createBuffer(src.numberOfChannels, newLen, ctx.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const a = src.getChannelData(c);
    const b = out.getChannelData(c);
    const last = a.length - 1;
    for (let i = 0; i < newLen; i++) {
      const x = i / ratio;
      const i0 = Math.min(last, Math.max(0, Math.floor(x)));
      const i1 = Math.min(last, i0 + 1);
      const t = x - i0;
      b[i] = a[i0] * (1 - t) + a[i1] * t;
    }
  }
  return out;
}

export function encodeWav(buffer: AudioBuffer, bitDepth: WavBitDepth = 16, dither = bitDepth === 16): Blob {
  const ch = buffer.numberOfChannels;
  const bits = bitDepth === 24 ? 24 : 16;
  const bytesPer = bits / 8;
  const dataBytes = buffer.length * ch * bytesPer;
  const ab = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(ab);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * ch * bytesPer, true);
  view.setUint16(32, ch * bytesPer, true);
  view.setUint16(34, bits, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  const channels = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      if (dither && bits === 16) {
        const tpdf = Math.random() + Math.random() - 1;
        s = Math.max(-1, Math.min(1, s + tpdf / 0x8000));
      }
      if (bits === 24) {
        let n = Math.round(s * 0x7fffff);
        if (n < 0) n += 0x1000000;
        view.setUint8(offset, n & 0xff);
        view.setUint8(offset + 1, (n >> 8) & 0xff);
        view.setUint8(offset + 2, (n >> 16) & 0xff);
        offset += 3;
      } else {
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}
