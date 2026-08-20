import type { MixerStripState } from "../types";
import type { ChannelStrip } from "./ChannelStrip";

export function snapshotStrip(ch: ChannelStrip): MixerStripState {
  return {
    volume: ch.volume.gain.value,
    gain: 20 * Math.log10(Math.max(1e-6, ch.trim.gain.value)),
    eq: [...ch.eq.user] as [number, number, number],
    eqKill: [...ch.eq.kills] as [boolean, boolean, boolean],
    filter: ch.filter.knob,
    mute: ch.muted,
    solo: ch.soloed,
    pan: ch.panner.pan.value,
    fx: {
      delay: ch.fx.delay.wet.gain.value,
      reverb: ch.fx.reverb.wet.gain.value,
      flanger: ch.fx.flanger.wet.gain.value,
      distortion: ch.fx.dist.wet.gain.value,
      bitcrush: ch.fx.crush.wet.gain.value,
      compressor: ch.fx.compAmount,
    },
    sendRev: ch.sendRev.gain.value,
    sendDly: ch.sendDly.gain.value,
  };
}

export function applyStripState(ch: ChannelStrip, state: MixerStripState | undefined): void {
  if (!state) {
    ch.setMute(true);
    return;
  }
  ch.setVolume(state.volume ?? 0.85);
  ch.setGainDb(state.gain ?? 0);
  const eq = state.eq ?? [0, 0, 0];
  ch.eq.set(eq[0], eq[1], eq[2]);
  ch.eq.setKills(state.eqKill ?? [false, false, false]);
  ch.filter.setKnob(state.filter ?? 0);
  ch.setPan(state.pan ?? 0);
  ch.setMute(!!state.mute);
  ch.setSolo(!!state.solo);
  for (const [kind, wet] of Object.entries(state.fx || {})) {
    ch.fx.setWet(kind, wet);
  }
  ch.setSendRev(state.sendRev ?? 0);
  ch.setSendDly(state.sendDly ?? 0);
}
