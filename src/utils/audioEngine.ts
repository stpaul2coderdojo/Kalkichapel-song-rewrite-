import { AudioFXSettings, LyricLine } from '../types/song';

export class KaraokeAudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private isProceduralTrack: boolean = false;
  private proceduralInterval: any = null;

  // Audio Nodes
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Vocal Canceler Nodes
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private invertNode: GainNode | null = null;
  private bassFilterNode: BiquadFilterNode | null = null;
  private dryVocalGain: GainNode | null = null;
  private wetVocalGain: GainNode | null = null;

  // FX Nodes
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;

  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;

  // Microphone Nodes
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private micReverbGain: GainNode | null = null;

  // Recording
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private onRecordCompleteCallback: ((blobUrl: string) => void) | null = null;

  // Current FX state
  private fxSettings: AudioFXSettings = {
    vocalRemover: false,
    vocalRemoverStrength: 0.85,
    reverbMix: 0.35,
    reverbDecay: 2.2,
    reverbType: 'hall',
    echoMix: 0.25,
    echoDelayTime: 0.3,
    echoFeedback: 0.4,
    pitchShiftSemitones: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    masterVolume: 1.0,
    micEnabled: false,
    micVolume: 1.2,
    micReverb: true,
  };

  // Event listeners
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private animFrameId: number | null = null;
  private lastTimeUpdateReport: number = 0;

  // Vocal tracking
  private currentLyrics: LyricLine[] = [];
  private speechVocalsEnabled: boolean = false;
  private lastSpokenIndex: number = -1;
  private isSpeakingSpeech: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupGraph();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupGraph() {
    if (!this.ctx) return;

    // Master Output & Analyser
    this.masterGain = this.ctx.createGain();
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // 3-Band EQ
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 250;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1500;
    this.eqMid.Q.value = 1.0;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 6000;

    // Connect EQ chain
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.masterGain);

    this.masterGain.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);

    // Setup Recording Stream Destination
    this.recordingDestination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.recordingDestination);

    // Setup Reverb
    this.setupReverb();

    // Setup Delay
    this.setupDelay();
  }

  private setupReverb() {
    if (!this.ctx) return;
    this.reverbNode = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbDryGain = this.ctx.createGain();

    this.createImpulseResponse(this.fxSettings.reverbDecay);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.eqLow!);
    this.reverbDryGain.connect(this.eqLow!);

    this.updateReverbMix(this.fxSettings.reverbMix);
  }

  private createImpulseResponse(durationSec: number) {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * Math.min(1.5, durationSec));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let decay = 1.0;
    const decayMultiplier = Math.exp(-1 / (rate * (Math.min(1.5, durationSec) / 3)));
    for (let i = 0; i < length; i++) {
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
      decay *= decayMultiplier;
    }

    if (this.reverbNode) {
      this.reverbNode.buffer = impulse;
    }
  }

  private setupDelay() {
    if (!this.ctx) return;
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = this.fxSettings.echoDelayTime;

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.value = this.fxSettings.echoFeedback;

    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.value = this.fxSettings.echoMix;

    // Loop
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.eqLow!);
  }

  /**
   * Load audio from ArrayBuffer or URL
   */
  public async loadAudio(source: ArrayBuffer | string): Promise<number> {
    this.init();
    if (!this.ctx) throw new Error('AudioContext not available');

    let buffer: ArrayBuffer;
    if (typeof source === 'string') {
      const res = await fetch(source);
      buffer = await res.arrayBuffer();
    } else {
      buffer = source;
    }

    this.audioBuffer = await this.ctx.decodeAudioData(buffer);
    this.pauseOffset = 0;
    this.isProceduralTrack = false;
    return this.audioBuffer.duration;
  }

  /**
   * Generate an ultra high fidelity procedural backing track matching BPM, key, genre and lyrics
   * Highly optimized: synthesizes a pristine 4-measure musical cycle and repeats via typed array blit
   */
  public generateProceduralTrack(
    bpm: number = 124, 
    key: string = 'A Minor', 
    durationSec: number = 65,
    lyrics?: LyricLine[],
    _vocalStyle: string = 'Lead Vocal',
    includeVocals: boolean = true
  ): number {
    this.init();
    if (!this.ctx) return durationSec;

    // Cache lyrics for synchronized stage highlight
    if (lyrics && lyrics.length > 0) {
      this.currentLyrics = lyrics;
    }

    const safeDuration = Math.max(10, Math.min(180, durationSec));
    const rate = this.ctx.sampleRate;
    const numFrames = Math.floor(rate * safeDuration);
    const buffer = this.ctx.createBuffer(2, numFrames, rate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const beatDuration = 60 / Math.max(60, Math.min(220, bpm));
    const beatsPerCycle = 16; // 4 measures of 4/4
    const cycleDuration = beatsPerCycle * beatDuration;
    const cycleFrames = Math.min(numFrames, Math.floor(cycleDuration * rate));

    const cycleLeft = new Float32Array(cycleFrames);
    const cycleRight = new Float32Array(cycleFrames);

    // Key & chord setup
    const isMinor = key.toLowerCase().includes('minor') || key.toLowerCase().includes('m');
    const rootFreq = key.startsWith('A') ? 220 : key.startsWith('C') ? 261.63 : key.startsWith('G') ? 196 : key.startsWith('F') ? 174.61 : 220;
    const scale = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const chords = [
      [0, 2, 4], // i or I
      [5, 0, 2], // VI or vi
      [3, 5, 0], // IV
      [4, 6, 1], // V
    ];

    // Synthesize the 4-measure groove (drums + chords + bass)
    for (let beat = 0; beat < beatsPerCycle; beat++) {
      const chordIndex = Math.floor(beat / 4) % chords.length;
      const currentChord = chords[chordIndex];
      const beatStartSample = Math.floor(beat * beatDuration * rate);
      const beatLength = Math.floor(beatDuration * rate);

      // 1. Kick on quarter notes
      const kickSamples = Math.min(Math.floor(rate * 0.18), beatLength);
      let kickDecay = 1.0;
      const kickDecayMult = Math.exp(-25 / rate);
      for (let i = 0; i < kickSamples; i++) {
        const t = i / rate;
        const kickFreq = 130 * kickDecay + 45;
        const kickVal = Math.sin(2 * Math.PI * kickFreq * t) * kickDecay * 0.42;
        const idx = beatStartSample + i;
        if (idx < cycleFrames) {
          cycleLeft[idx] += kickVal;
          cycleRight[idx] += kickVal;
        }
        kickDecay *= kickDecayMult;
      }

      // 2. Snare / Clap on beats 1 and 3 (0-indexed: 1, 3, 5, 7...)
      if (beat % 2 === 1) {
        const snareSamples = Math.min(Math.floor(rate * 0.16), beatLength);
        let snareDecay = 1.0;
        const snareDecayMult = Math.exp(-22 / rate);
        for (let i = 0; i < snareSamples; i++) {
          const t = i / rate;
          const noise = (Math.random() * 2 - 1) * snareDecay * 0.22;
          const body = Math.sin(2 * Math.PI * 190 * t) * snareDecay * 0.18;
          const idx = beatStartSample + i;
          if (idx < cycleFrames) {
            cycleLeft[idx] += (noise + body);
            cycleRight[idx] += (noise + body);
          }
          snareDecay *= snareDecayMult;
        }
      }

      // 3. Hi-hats on 8th / 16th notes
      const subBeats = 2;
      const subLength = Math.floor(beatLength / subBeats);
      for (let sub = 0; sub < subBeats; sub++) {
        const subStart = beatStartSample + sub * subLength;
        const hatSamples = Math.min(Math.floor(rate * 0.035), subLength);
        let hatDecay = 1.0;
        const hatDecayMult = Math.exp(-65 / rate);
        for (let i = 0; i < hatSamples; i++) {
          const hh = (Math.random() * 2 - 1) * hatDecay * (sub === 1 ? 0.12 : 0.08);
          const idx = subStart + i;
          if (idx < cycleFrames) {
            cycleLeft[idx] += hh * 0.85;
            cycleRight[idx] += hh * 1.15;
          }
          hatDecay *= hatDecayMult;
        }
      }

      // 4. Synth pad chords
      for (const noteIdx of currentChord) {
        const semitones = scale[noteIdx % scale.length] + Math.floor(noteIdx / scale.length) * 12;
        const freq = rootFreq * Math.pow(2, semitones / 12);
        for (let i = 0; i < beatLength; i++) {
          const t = i / rate;
          const env = Math.sin((i / beatLength) * Math.PI) * 0.08;
          const sample = Math.sin(2 * Math.PI * freq * t) * env;
          const idx = beatStartSample + i;
          if (idx < cycleFrames) {
            cycleLeft[idx] += sample * 0.8;
            cycleRight[idx] += sample * 1.1;
          }
        }
      }

      // 5. Bassline (driving root / octave)
      const bassDegree = currentChord[0];
      const bassFreq = (rootFreq / 2) * Math.pow(2, scale[bassDegree % scale.length] / 12);
      const halfBeat = Math.floor(beatLength / 2);
      for (let h = 0; h < 2; h++) {
        const hStart = beatStartSample + h * halfBeat;
        let bassDecay = 1.0;
        const bassDecayMult = Math.exp(-8 / rate);
        for (let i = 0; i < halfBeat; i++) {
          const t = i / rate;
          const bassSample = Math.sin(2 * Math.PI * bassFreq * t) * bassDecay * 0.22;
          const idx = hStart + i;
          if (idx < cycleFrames) {
            cycleLeft[idx] += bassSample;
            cycleRight[idx] += bassSample;
          }
          bassDecay *= bassDecayMult;
        }
      }
    }

    // Ultra fast array blit: tile the 4-measure cycle across the entire track duration
    let curOffset = 0;
    while (curOffset < numFrames) {
      const copyLen = Math.min(cycleFrames, numFrames - curOffset);
      left.set(cycleLeft.subarray(0, copyLen), curOffset);
      right.set(cycleRight.subarray(0, copyLen), curOffset);
      curOffset += copyLen;
    }

    // Overlay centered melodic vocal line if requested
    if (includeVocals) {
      const activeLyricsList = (lyrics && lyrics.length > 0) ? lyrics : [
        { id: 'l1', time: 2, endTime: 6, section: 'Verse 1', text: 'Singing with the rhythm of the night', syllables: 9 },
        { id: 'l2', time: 7, endTime: 11, section: 'Verse 1', text: 'Catch the melody and hold it tight', syllables: 9 },
      ];

      for (const line of activeLyricsList) {
        const lineStartSec = line.time;
        const lineEndSec = line.endTime || (lineStartSec + 3.8);
        const lineDur = Math.max(1.5, Math.min(8.0, lineEndSec - lineStartSec));
        const syllableCount = Math.max(3, Math.min(12, line.syllables || 6));
        const sylDuration = (lineDur * 0.9) / syllableCount;
        const isChorus = line.section?.toLowerCase().includes('chorus');

        for (let s = 0; s < syllableCount; s++) {
          const sylStart = lineStartSec + s * sylDuration;
          const sylEnd = sylStart + sylDuration * 0.85;
          const startSample = Math.floor(sylStart * rate);
          const endSample = Math.min(numFrames, Math.floor(sylEnd * rate));
          const sylLength = endSample - startSample;
          if (sylLength <= 0 || startSample >= numFrames) continue;

          const noteStep = isChorus ? (s % 2 === 0 ? 4 : 7) : (s % 2 === 0 ? 0 : 3);
          const oct = isChorus ? 2 : 1;
          const semitones = scale[noteStep % scale.length] + oct * 12;
          const vocalFreq = (rootFreq * 1.4) * Math.pow(2, semitones / 12);

          const attackSamples = Math.min(Math.floor(rate * 0.025), Math.floor(sylLength / 3));
          const releaseSamples = Math.min(Math.floor(rate * 0.04), Math.floor(sylLength / 3));

          for (let i = 0; i < sylLength; i++) {
            const t = i / rate;
            const sine1 = Math.sin(2 * Math.PI * vocalFreq * t) * 0.22;
            const sine2 = Math.sin(2 * Math.PI * vocalFreq * 2 * t) * 0.08;

            let env = 1.0;
            if (i < attackSamples) env = i / attackSamples;
            else if (i > sylLength - releaseSamples) env = (sylLength - i) / releaseSamples;

            const vocalSample = (sine1 + sine2) * env;
            const idx = startSample + i;
            if (idx < numFrames) {
              left[idx] += vocalSample;
              right[idx] += vocalSample;
            }
          }
        }
      }
    }

    // Soft limiter
    let peak = 0;
    for (let i = 0; i < numFrames; i += 16) {
      const a = Math.abs(left[i]);
      if (a > peak) peak = a;
    }
    if (peak > 0.95) {
      const norm = 0.92 / peak;
      for (let i = 0; i < numFrames; i++) {
        left[i] *= norm;
        right[i] *= norm;
      }
    }

    this.audioBuffer = buffer;
    this.pauseOffset = 0;
    this.isProceduralTrack = true;
    return safeDuration;
  }

  /**
   * Play audio
   */
  public play(fromTime?: number) {
    this.init();
    if (!this.ctx || !this.audioBuffer) return;

    if (this.isPlaying) {
      this.stopSource();
    }

    const offset = typeof fromTime === 'number' ? fromTime : this.pauseOffset;
    if (offset >= this.audioBuffer.duration) {
      this.pauseOffset = 0;
    }

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Pitch shift / Playback rate
    this.updatePitchShift(this.fxSettings.pitchShiftSemitones);

    // Setup Routing: Vocal Remover DSP or direct
    this.setupSourceRouting(this.sourceNode);

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        if (this.onEndedCallback) this.onEndedCallback();
      }
    };

    this.startTime = this.ctx.currentTime - (typeof fromTime === 'number' ? fromTime : this.pauseOffset);
    this.sourceNode.start(0, typeof fromTime === 'number' ? fromTime : this.pauseOffset);
    this.isPlaying = true;

    this.startTimeTracking();
  }

  /**
   * Configure Vocal Removal DSP vs Clean Passthrough
   */
  private setupSourceRouting(source: AudioBufferSourceNode) {
    if (!this.ctx) return;

    if (this.fxSettings.vocalRemover) {
      // Split into Left and Right channels
      this.splitterNode = this.ctx.createChannelSplitter(2);
      this.mergerNode = this.ctx.createChannelMerger(2);

      // Phase invert node for Right channel
      this.invertNode = this.ctx.createGain();
      this.invertNode.gain.value = -1;

      // Bass preservation filter (keeps kick and low bass that would otherwise cancel)
      this.bassFilterNode = this.ctx.createBiquadFilter();
      this.bassFilterNode.type = 'lowpass';
      this.bassFilterNode.frequency.value = 160;

      // Wet / Dry gains
      this.dryVocalGain = this.ctx.createGain();
      this.wetVocalGain = this.ctx.createGain();

      const strength = this.fxSettings.vocalRemoverStrength;
      this.dryVocalGain.gain.value = 1 - strength;
      this.wetVocalGain.gain.value = strength;

      source.connect(this.dryVocalGain);
      this.dryVocalGain.connect(this.reverbDryGain!);
      this.dryVocalGain.connect(this.reverbNode!);
      this.dryVocalGain.connect(this.delayNode!);

      // Invert routing for center cancellation
      source.connect(this.splitterNode);
      // L - R difference node
      const diffGain = this.ctx.createGain();
      this.splitterNode.connect(diffGain, 0); // Left channel
      this.splitterNode.connect(this.invertNode, 1); // Right channel inverted
      this.invertNode.connect(diffGain);

      diffGain.connect(this.mergerNode, 0, 0);
      diffGain.connect(this.mergerNode, 0, 1);

      // Re-add low bass mono
      source.connect(this.bassFilterNode);
      this.bassFilterNode.connect(this.mergerNode, 0, 0);
      this.bassFilterNode.connect(this.mergerNode, 0, 1);

      this.mergerNode.connect(this.wetVocalGain);
      this.wetVocalGain.connect(this.reverbDryGain!);
      this.wetVocalGain.connect(this.reverbNode!);
      this.wetVocalGain.connect(this.delayNode!);
    } else {
      // Direct stereo routing
      source.connect(this.reverbDryGain!);
      source.connect(this.reverbNode!);
      source.connect(this.delayNode!);
    }
  }

  public pause() {
    if (!this.isPlaying || !this.ctx) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.pauseOffset = this.getCurrentTime();
    this.stopSource();
    this.isPlaying = false;
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.lastSpokenIndex = -1;
    this.stopSource();
    this.pauseOffset = 0;
    this.isPlaying = false;
  }

  private stopSource() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public seek(timeSeconds: number) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseOffset = Math.max(0, Math.min(timeSeconds, this.getDuration()));
    if (wasPlaying) {
      this.play(this.pauseOffset);
    } else if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.pauseOffset);
    }
  }

  public getCurrentTime(): number {
    if (!this.ctx || !this.isPlaying) return this.pauseOffset;
    const elapsed = (this.ctx.currentTime - this.startTime) * (this.sourceNode?.playbackRate.value || 1);
    return Math.min(elapsed, this.getDuration());
  }

  public getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setSpeechVocalsEnabled(enabled: boolean) {
    this.speechVocalsEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeechVocalsEnabled(): boolean {
    return this.speechVocalsEnabled;
  }

  private startTimeTracking() {
    this.lastTimeUpdateReport = 0;
    const tick = () => {
      if (this.isPlaying) {
        const curr = this.getCurrentTime();
        const now = performance.now();

        // Throttle React state updates from 144Hz down to smooth 22Hz (~45ms)
        if (this.onTimeUpdateCallback && (now - this.lastTimeUpdateReport >= 45 || curr === 0)) {
          this.lastTimeUpdateReport = now;
          this.onTimeUpdateCallback(curr);
        }

        // Vocal Speech Synchronization ONLY if enabled, non-blocking and safe
        if (
          this.speechVocalsEnabled && 
          !this.fxSettings.vocalRemover && 
          typeof window !== 'undefined' && 
          'speechSynthesis' in window &&
          this.currentLyrics.length > 0 &&
          !this.isSpeakingSpeech
        ) {
          const lineIdx = this.currentLyrics.findIndex(
            (l) => curr >= l.time && curr < (l.endTime || l.time + 3.5)
          );
          if (lineIdx !== -1 && lineIdx !== this.lastSpokenIndex) {
            this.lastSpokenIndex = lineIdx;
            try {
              const text = this.currentLyrics[lineIdx].text;
              const utt = new SpeechSynthesisUtterance(text);
              utt.rate = 1.0;
              utt.pitch = 1.05;
              this.isSpeakingSpeech = true;
              utt.onend = () => { this.isSpeakingSpeech = false; };
              utt.onerror = () => { this.isSpeakingSpeech = false; };
              window.speechSynthesis.speak(utt);
            } catch (e) {
              this.isSpeakingSpeech = false;
            }
          }
        }
      }
      if (this.isPlaying) {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  // --- Real-Time FX Setters ---

  public updateFX(settings: Partial<AudioFXSettings>) {
    this.fxSettings = { ...this.fxSettings, ...settings };

    if (settings.masterVolume !== undefined && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(settings.masterVolume, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.reverbMix !== undefined) {
      this.updateReverbMix(settings.reverbMix);
    }

    if (settings.reverbDecay !== undefined) {
      this.createImpulseResponse(settings.reverbDecay);
    }

    if (settings.echoMix !== undefined && this.delayWetGain) {
      this.delayWetGain.gain.setTargetAtTime(settings.echoMix, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.echoDelayTime !== undefined && this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(settings.echoDelayTime, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.echoFeedback !== undefined && this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.setTargetAtTime(settings.echoFeedback, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.pitchShiftSemitones !== undefined) {
      this.updatePitchShift(settings.pitchShiftSemitones);
    }

    if (settings.eqLow !== undefined && this.eqLow) {
      this.eqLow.gain.setTargetAtTime(settings.eqLow, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.eqMid !== undefined && this.eqMid) {
      this.eqMid.gain.setTargetAtTime(settings.eqMid, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.eqHigh !== undefined && this.eqHigh) {
      this.eqHigh.gain.setTargetAtTime(settings.eqHigh, this.ctx?.currentTime || 0, 0.05);
    }

    if (settings.vocalRemover !== undefined || settings.vocalRemoverStrength !== undefined) {
      if (settings.vocalRemover && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      // Re-route on the fly if playing
      if (this.isPlaying) {
        const curr = this.getCurrentTime();
        this.play(curr);
      }
    }

    if (settings.micEnabled !== undefined) {
      this.toggleMicrophone(settings.micEnabled);
    }
  }

  private updateReverbMix(mix: number) {
    if (!this.ctx || !this.reverbGain || !this.reverbDryGain) return;
    this.reverbGain.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.05);
    this.reverbDryGain.gain.setTargetAtTime(1 - mix * 0.5, this.ctx.currentTime, 0.05);
  }

  private updatePitchShift(semitones: number) {
    if (!this.sourceNode || !this.ctx) return;
    const rate = Math.pow(2, semitones / 12);
    this.sourceNode.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
  }

  // --- Microphone Support ---

  public async toggleMicrophone(enable: boolean) {
    this.init();
    if (!this.ctx) return;

    if (enable) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });

        this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = this.fxSettings.micVolume;

        // Route mic through EQ & Reverb for studio karaoke sound!
        this.micSourceNode.connect(this.micGain);
        this.micGain.connect(this.eqLow!);
        this.micGain.connect(this.reverbNode!); // add karaoke reverb to user's voice
        this.micGain.connect(this.delayNode!);  // add echo to user's voice
      } catch (err) {
        console.warn('Microphone access denied or error:', err);
        this.fxSettings.micEnabled = false;
      }
    } else {
      if (this.micStream) {
        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;
      }
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
    }
  }

  // --- Performance Recording (Backing + Voice) ---

  public startRecording() {
    this.init();
    if (!this.recordingDestination) return;

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      if (this.onRecordCompleteCallback) {
        this.onRecordCompleteCallback(url);
      }
    };

    this.mediaRecorder.start(200);
  }

  public stopRecording(callback: (blobUrl: string) => void) {
    this.onRecordCompleteCallback = callback;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  // --- Visualizer Data ---

  public getVisualizerData(freqArray: Uint8Array, waveArray?: Uint8Array) {
    if (this.analyserNode) {
      (this.analyserNode as any).getByteFrequencyData(freqArray);
      if (waveArray) {
        (this.analyserNode as any).getByteTimeDomainData(waveArray);
      }
    }
  }

  // --- Export Helper: Convert Buffer to WAV ---

  public exportWavBlob(): Blob | null {
    if (!this.audioBuffer) return null;
    return bufferToWave(this.audioBuffer, 0, this.audioBuffer.length);
  }

  // Event subscribers
  public onTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }
}

// Convert AudioBuffer to WAV Blob
function bufferToWave(abuffer: AudioBuffer, offset: number, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = abuffer.sampleRate;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);  // file length - 8
  setUint32(0x45564157); // "WAVE"

  // format chunk identifier
  setUint32(0x20746d66); // "fmt "
  setUint32(16);          // format size
  setUint16(1);           // format 1 (PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);              // block align
  setUint16(16);                         // 16-bit depth

  // data chunk identifier
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][offset + i]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

// Global audio engine singleton
export const audioEngine = new KaraokeAudioEngine();
