export type StudioMode = "dj" | "arrange" | "drums" | "synth";

export type OscType = "sine" | "square" | "sawtooth" | "triangle";

export interface AudioAnalysis {
  duration: number;
  sample_rate: number;
  channels: number;
  waveform: number[];
  bpm: number;
  beats: number[];
  key: string;
  loudness_rms: number;
  peak: number;
  loudness_db: number;
  onsets: number[];
  engine: string;
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
}

export interface DrumSteps {
  [padId: string]: number[]; // 0..1 velocity per step
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

export interface DeckState {
  audioFileId: string | null;
  pitch: number;
  volume: number;
  cue: number;
  loop: { start: number; end: number } | null;
  hotcues: Record<number, number>;
}

export interface ProjectDetail {
  id: string;
  user_id: string;
  name: string;
  description: string;
  bpm: number;
  time_signature: string;
  musical_key: string;
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

export interface AIAction {
  type: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AIAction[];
}
