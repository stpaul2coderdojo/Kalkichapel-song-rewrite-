export interface LyricLine {
  id: string;
  time: number; // in seconds
  endTime?: number; // in seconds
  text: string;
  section: 'Intro' | 'Verse 1' | 'Verse 2' | 'Verse 3' | 'Chorus' | 'Pre-Chorus' | 'Bridge' | 'Outro' | 'Hook';
  syllables: number;
  rhymeKey?: string;
  chords?: string;
  notes?: string;
}

export interface AgentThought {
  id: string;
  timestamp: string;
  step: string;
  tool?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  duration: number; // in seconds
  mood: string;
  energyLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  vocalStyle: string;
}

export interface SongData {
  id: string;
  title: string;
  artist: string;
  sourceType: 'upload' | 'url' | 'sample';
  platform?: 'youtube' | 'soundcloud' | 'spotify' | 'web';
  externalUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
  embedHtml?: string;
  audioUrl: string;
  audioBase64?: string;
  mimeType?: string;
  duration: number;
  metadata: SongMetadata;
  lyrics: LyricLine[];
  agentTrace: AgentThought[];
  isAnalyzed: boolean;
}

export interface RegeneratedSong {
  id: string;
  title: string;
  vocalStyle: string;
  arrangementStyle: string;
  bpm: number;
  key: string;
  audioUrl: string;
  lyrics: LyricLine[];
  timestamp: string;
  agentNotes: string;
  duration: number;
}

export interface AudioFXSettings {
  vocalRemover: boolean;
  vocalRemoverStrength: number; // 0 to 1
  reverbMix: number; // 0 to 1
  reverbDecay: number; // 0.1 to 5
  reverbType: 'hall' | 'arena' | 'studio' | 'space';
  echoMix: number; // 0 to 1
  echoDelayTime: number; // 0.05 to 1.0 (sec)
  echoFeedback: number; // 0 to 0.8
  pitchShiftSemitones: number; // -6 to +6
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  masterVolume: number; // 0 to 1.5
  micEnabled: boolean;
  micVolume: number; // 0 to 2
  micReverb: boolean;
}
