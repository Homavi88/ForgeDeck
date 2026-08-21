export type StudioMode = "dj" | "session" | "arrange" | "drums" | "synth" | "sampler";

export type OscType = "sine" | "square" | "sawtooth" | "triangle";

export const STEM_NAMES = ["vocals", "drums", "bass", "other"] as const;
export type StemName = (typeof STEM_NAMES)[number];

export interface AudioAnalysis {
  duration: number;
  sample_rate: number;
  channels: number;
  waveform: number[];
  bpm: number;
  beats: number[];
  key: string;
  camelot?: string;
  loudness_rms: number;
  peak: number;
  loudness_db: number;
  onsets: number[];
  engine: string;
  stems?: Record<string, string>;
  /** 1–10 from RMS / loudness_db (crate energy). */
  energy?: number;
  /** Seconds — first solid phrase (beatgrid heuristic). */
  mix_in?: number;
  /** Seconds — last phrase start (beatgrid heuristic). */
  mix_out?: number;
}

export interface AudioFile {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  duration: number | null;
  sample_rate: number | null;
  channels: number | null;
  file_size: number;
  analysis_status: "pending" | "processing" | "ready" | "error" | string;
  analysis: AudioAnalysis | null;
  error_message: string | null;
  created_at?: string | null;
}

export interface MixerChannel {
  id: string;
  name: string;
  role: string;
  gain: number;
  eq_low: number;
  eq_mid: number;
  eq_high: number;
  filter_knob: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  volume: number;
  fx?: EffectSlot[];
}

export interface EffectSlot {
  type: string;
  enabled: boolean;
  wet: number;
  params: Record<string, number>;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  startBar: number;
  lengthBars: number;
  color: string;
  audioFileId?: string | null;
  kind?: string;
  /** Stem layer name when this clip is a remix of a split stem. */
  stem?: string | null;
  sourceBpm?: number | null;
  sourceKey?: string | null;
  /** Transpose warped audio to project musical_key (Rubber Band). */
  keyFollow?: boolean;
  /** Linear gain fade-in at clip start (arrangement bars). Audio clips only. */
  fadeInBars?: number;
  /** Linear gain fade-out at clip end (arrangement bars). Audio clips only. */
  fadeOutBars?: number;
}

export interface DrumSteps {
  [padId: string]: number[];
}

export interface SynthParams {
  oscType: OscType;
  gain: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  resonance: number;
  lfoRate: number;
  lfoDepth: number;
  lfoTarget: "filter" | "pitch";
  poly: boolean;
  unison?: number;
}

export interface MidiNote {
  id: string;
  pitch: number;
  startStep: number;
  length: number;
  velocity: number;
}

/** Public payload from GET /api/presets/styles — original ForgeDeck templates, not third-party banks. */
export interface StylePack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  key: string;
  blurb: string;
  synth: SynthParams;
  fx: Record<string, number>;
  drums: {
    length: number;
    swing: number;
    steps: DrumSteps;
  };
  notes: MidiNote[];
}

export type StylePackParts = "all" | "drums" | "synth";

export interface MidiPattern {
  id: string;
  name: string;
  notes: MidiNote[];
}

export interface SessionClip {
  id: string;
  trackId: string;
  scene: number;
  name: string;
  kind: "drums" | "midi" | "audio";
  lengthBars: number;
  color: string;
  empty: boolean;
  audioFileId?: string | null;
  stem?: string | null;
  sourceBpm?: number | null;
  sourceKey?: string | null;
  keyFollow?: boolean;
}

export interface AutomationLaneState {
  target: string;
  points: Array<{ time: number; value: number }>;
}

export type MixRole = "deck" | "drums" | "synth" | "audio";

/** Extra arrange/session/mixer lane (beyond Deck A/B, drums, synth). */
export interface MixLane {
  id: string;
  name: string;
  color: string;
  role: MixRole;
}

export interface MixerStripState {
  volume: number;
  gain: number;
  eq: [number, number, number];
  eqKill: [boolean, boolean, boolean];
  filter: number;
  mute: boolean;
  solo: boolean;
  pan: number;
  fx: Record<string, number>;
  /** Device-rack bypass: eq/filter plus EffectChain kinds. */
  bypass?: Record<string, boolean>;
  /** Aux send into mixer return reverb (0–1). */
  sendRev?: number;
  /** Aux send into mixer return delay (0–1). */
  sendDly?: number;
  /** Serial insert order (EQ / filter / FX). Missing → stock ChannelStrip order. */
  insertOrder?: string[];
}

export interface FxReturnsState {
  reverb: number;
  delay: number;
}

export interface SamplerState {
  audioFileId: string | null;
  start: number;
  end: number;
  reverse: boolean;
  loop: boolean;
  playbackRate: number;
}

export interface ProjectDetail {
  id: string;
  user_id: string;
  name: string;
  description: string;
  bpm: number;
  time_signature: string;
  musical_key: string;
  graph_revision: number;
  share_token?: string | null;
  graph: Record<string, unknown>;
  tracks: Array<{
    id: string;
    name: string;
    kind: string;
    color: string;
    audio_file_id: string | null;
    muted: boolean;
    solo: boolean;
    volume: number;
    pan: number;
    clips: Array<{
      id: string;
      name: string;
      start_time: number;
      duration: number;
      color: string;
      audio_file_id: string | null;
    }>;
  }>;
  decks: Array<{ id: string; name: string; audio_file_id: string | null; pitch: number; volume: number }>;
  mixer_channels: MixerChannel[];
  drum_patterns: Array<{
    id: string;
    name: string;
    length: number;
    swing: number;
    bpm: number;
    steps: DrumSteps;
  }>;
  synth_presets: Array<{ id: string; name: string; params: SynthParams }>;
  arrangements: Array<{
    id: string;
    name: string;
    length_bars: number;
    structure: Array<{ name: string; bars: number; energy: number }>;
  }>;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  revision: number;
  label: string;
  graph: Record<string, unknown>;
  created_at?: string | null;
}

export interface AIAction {
  type: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AIAction[];
}
