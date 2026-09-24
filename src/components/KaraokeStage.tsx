import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Mic, 
  MicOff, 
  Volume2, 
  Sliders, 
  Maximize2, 
  Minimize2, 
  Download, 
  Sparkles, 
  Music, 
  CircleDot, 
  Disc,
  Radio,
  FileDown,
  Youtube,
  Cloud,
  ExternalLink
} from 'lucide-react';
import { SongData, RegeneratedSong, LyricLine, AudioFXSettings } from '../types/song';
import { audioEngine } from '../utils/audioEngine';

interface KaraokeStageProps {
  song: SongData;
  regeneratedSong: RegeneratedSong | null;
  playbackTime: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onRestart: () => void;
  onOpenExportModal: () => void;
}

export const KaraokeStage: React.FC<KaraokeStageProps> = ({
  song,
  regeneratedSong,
  playbackTime,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onRestart,
  onOpenExportModal,
}) => {
  const [activeLyrics, setActiveLyrics] = useState<LyricLine[]>(
    regeneratedSong ? regeneratedSong.lyrics : song.lyrics
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFXDrawer, setShowFXDrawer] = useState(true);
  const [useRegeneratedAudio, setUseRegeneratedAudio] = useState(!!regeneratedSong);
  const [speechVocals, setSpeechVocals] = useState<boolean>(true);
  const [showMediaEmbed, setShowMediaEmbed] = useState<boolean>(false);

  // FX Settings state
  const [fx, setFx] = useState<AudioFXSettings>({
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
  });

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  // Refs for visualizer & scrolling
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Sync lyrics if regenerated song changes
  useEffect(() => {
    if (regeneratedSong && useRegeneratedAudio) {
      setActiveLyrics(regeneratedSong.lyrics);
    } else {
      setActiveLyrics(song.lyrics);
    }
  }, [regeneratedSong, useRegeneratedAudio, song]);

  // Update audio engine FX
  const handleFXChange = (settings: Partial<AudioFXSettings>) => {
    const updated = { ...fx, ...settings };
    setFx(updated);
    audioEngine.updateFX(settings);
  };

  // Find currently active lyric line
  const currentLineIndex = activeLyrics.findIndex((line, idx) => {
    const nextLine = activeLyrics[idx + 1];
    const endTime = line.endTime || (nextLine ? nextLine.time : line.time + 4.0);
    return playbackTime >= line.time && playbackTime < endTime;
  });

  const activeLine = currentLineIndex !== -1 ? activeLyrics[currentLineIndex] : null;
  const nextLine = currentLineIndex !== -1 && currentLineIndex < activeLyrics.length - 1 
    ? activeLyrics[currentLineIndex + 1] 
    : null;

  // Auto scroll to current lyric line
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex]);

  // Visualizer Animation Loop - only active when audio is playing to prevent UI lag
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqData = new Uint8Array(64);

    const drawFrame = (active: boolean) => {
      if (active) {
        audioEngine.getVisualizerData(freqData);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barCount = 32;
      const barWidth = (width / barCount) * 0.7;

      for (let i = 0; i < barCount; i++) {
        const val = active ? freqData[i * 2] : 12;
        const barHeight = Math.max(4, (val / 255) * height * 0.85);
        const x = i * (width / barCount) + (width / barCount - barWidth) / 2;
        const y = height - barHeight;

        // Gradient
        const grad = ctx.createLinearGradient(0, y, 0, height);
        grad.addColorStop(0, '#f43f5e'); // rose
        grad.addColorStop(0.5, '#a855f7'); // purple
        grad.addColorStop(1, '#06b6d4'); // cyan

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        // Top cap glow
        if (barHeight > 6) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, barWidth, 2);
        }
      }
    };

    if (!isPlaying) {
      // Draw single clean idle frame
      drawFrame(false);
      return;
    }

    const render = () => {
      drawFrame(true);
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Recording controls
  const handleToggleRecording = () => {
    if (isRecording) {
      audioEngine.stopRecording((url) => {
        setRecordedUrl(url);
        setIsRecording(false);
      });
    } else {
      setRecordedUrl(null);
      audioEngine.startRecording();
      setIsRecording(true);
    }
  };

  const totalDuration = audioEngine.getDuration() || (regeneratedSong ? regeneratedSong.duration : song.duration);
  const progressRatio = totalDuration > 0 ? (playbackTime / totalDuration) * 100 : 0;

  // Syllable progress percentage for current line
  let lineProgress = 0;
  if (activeLine) {
    const start = activeLine.time;
    const end = activeLine.endTime || start + 3.8;
    lineProgress = Math.max(0, Math.min(100, ((playbackTime - start) / (end - start)) * 100));
  }

  return (
    <div 
      ref={stageContainerRef}
      className={`relative rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-6 flex flex-col justify-between' : 'p-6 md:p-8 space-y-6'
      }`}
    >
      {/* Stage Backdrop Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-600 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600 rounded-full blur-[140px]" />
      </div>

      {/* Stage Top Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-500 to-cyan-500 p-0.5 shadow-lg shadow-fuchsia-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Mic className="w-5 h-5 text-fuchsia-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">
                {regeneratedSong && useRegeneratedAudio ? regeneratedSong.title : song.title}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                LIVE STAGE
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {song.metadata.bpm} BPM • Key: {song.metadata.key} • {song.metadata.genre}
            </p>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Lead Vocals / Karaoke Mode Switch */}
          <button
            onClick={() => handleFXChange({ vocalRemover: !fx.vocalRemover })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              !fx.vocalRemover
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
            title={!fx.vocalRemover ? 'Lead vocals are playing. Click to mute vocals for karaoke.' : 'Vocals are muted. Click to hear lead vocals.'}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{!fx.vocalRemover ? 'Lead Vocals: ON' : 'Karaoke: Vocals Muted'}</span>
          </button>

          {/* Synchronized Speech Vocals Toggle */}
          <button
            onClick={() => {
              const next = !speechVocals;
              setSpeechVocals(next);
              audioEngine.setSpeechVocalsEnabled(next);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              speechVocals
                ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
            title="Toggle synchronized spoken lyric recitation"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{speechVocals ? 'Speech Singer: ON' : 'Speech Singer: OFF'}</span>
          </button>

          {/* Switch Audio Track (Original vs Regenerated) */}
          {regeneratedSong && (
            <button
              onClick={() => setUseRegeneratedAudio(!useRegeneratedAudio)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                useRegeneratedAudio
                  ? 'bg-fuchsia-950/80 border-fuchsia-500 text-fuchsia-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{useRegeneratedAudio ? 'Regenerated Mix' : 'Original Mix'}</span>
            </button>
          )}

          {/* Toggle FX Rack Panel */}
          <button
            onClick={() => setShowFXDrawer(!showFXDrawer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              showFXDrawer
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Audio FX Rack</span>
          </button>

          {/* Media Player Toggle (YouTube, SoundCloud, Spotify) */}
          {(song.platform === 'youtube' || song.platform === 'soundcloud' || song.platform === 'spotify' || song.videoId) && (
            <button
              onClick={() => setShowMediaEmbed(!showMediaEmbed)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                showMediaEmbed
                  ? song.platform === 'youtube'
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-sm'
                    : song.platform === 'soundcloud'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
              title="Toggle media player"
            >
              {song.platform === 'youtube' ? (
                <Youtube className="w-3.5 h-3.5 text-rose-500" />
              ) : song.platform === 'soundcloud' ? (
                <Cloud className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Disc className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span>
                {showMediaEmbed
                  ? `Hide ${song.platform === 'youtube' ? 'Video' : 'Player'}`
                  : `${song.platform === 'youtube' ? 'Watch YouTube Video' : song.platform === 'soundcloud' ? 'SoundCloud' : 'Spotify Player'}`}
              </span>
            </button>
          )}

          {/* Record Performance Button */}
          <button
            onClick={handleToggleRecording}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5 text-rose-400" />
            <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
          </button>

          {/* Export Lyrics / Audio */}
          <button
            onClick={onOpenExportModal}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition"
            title="Export Synchronized Lyrics (.lrc) & Audio"
          >
            <FileDown className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition"
            title="Toggle Stage Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Media Player Drawer (YouTube Video / SoundCloud / Spotify) */}
      {showMediaEmbed && (
        <div className="relative z-10 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/90 shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              {song.platform === 'youtube' && (
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span>YouTube Music Video</span>
                </span>
              )}
              {song.platform === 'soundcloud' && (
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-amber-500" />
                  <span>SoundCloud Player</span>
                </span>
              )}
              {song.platform === 'spotify' && (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Disc className="w-4 h-4 text-emerald-500" />
                  <span>Spotify Player</span>
                </span>
              )}
              <span className="text-zinc-400 font-medium">
                • {song.title} {song.artist ? `by ${song.artist}` : ''}
              </span>
            </div>
            {song.externalUrl && (
              <a
                href={song.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              >
                <span>Open Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {song.platform === 'youtube' && song.videoId && (
            <div className="aspect-video w-full max-h-[340px] rounded-xl overflow-hidden bg-black mx-auto shadow-inner">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${song.videoId}?autoplay=0&enablejsapi=1`}
                title={song.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {song.platform === 'soundcloud' && (
            <div className="rounded-xl overflow-hidden bg-black">
              {song.embedHtml ? (
                <div dangerouslySetInnerHTML={{ __html: song.embedHtml }} />
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400">
                  SoundCloud Track: {song.title}
                </div>
              )}
            </div>
          )}

          {song.platform === 'spotify' && (
            <div className="rounded-xl overflow-hidden bg-black">
              {song.embedHtml ? (
                <div dangerouslySetInnerHTML={{ __html: song.embedHtml }} />
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400">
                  Spotify Track: {song.title}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Stage Arena */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left / Center: Dynamic Karaoke Teleprompter Screen */}
        <div className={`space-y-6 flex flex-col justify-between ${showFXDrawer ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {/* Main Stage Display */}
          <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[360px] text-center">
            {/* Visualizer Canvas in Background */}
            <div className="absolute inset-x-0 bottom-0 h-32 opacity-40 pointer-events-none">
              <canvas ref={canvasRef} width={640} height={128} className="w-full h-full" />
            </div>

            {/* Section Badge */}
            <div className="relative z-10 flex items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/80 text-xs font-mono font-bold text-cyan-400">
                {activeLine ? activeLine.section : 'Stage Ready'}
              </span>
              {activeLine?.chords && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-xs font-mono text-indigo-300">
                  {activeLine.chords}
                </span>
              )}
            </div>

            {/* Active Lyric Line with Glowing Bouncing Ball / Wipe */}
            <div className="relative z-10 my-auto py-8 space-y-4">
              {activeLine ? (
                <div className="space-y-3">
                  {/* Bouncing ball guide */}
                  <div className="h-6 relative max-w-lg mx-auto">
                    <div 
                      className="absolute bottom-0 w-4 h-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/80 transition-all duration-75 transform -translate-x-1/2"
                      style={{ 
                        left: `${lineProgress}%`,
                        bottom: `${Math.sin((lineProgress / 100) * Math.PI * 4) * 8 + 4}px`
                      }}
                    />
                  </div>

                  {/* Highlighted Glowing Lyric Text */}
                  <div className="relative inline-block text-2xl md:text-4xl lg:text-5xl font-black tracking-tight select-none">
                    {/* Background muted text */}
                    <span className="text-zinc-600 block">
                      {activeLine.text}
                    </span>
                    {/* Glowing highlight overlay wiped by progress */}
                    <span 
                      className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 overflow-hidden whitespace-nowrap drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]"
                      style={{ width: `${lineProgress}%` }}
                    >
                      {activeLine.text}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 font-bold text-xl md:text-2xl animate-pulse">
                  🎵 Press Play to Start Singing 🎵
                </div>
              )}

              {/* Upcoming Line Preview */}
              {nextLine && (
                <div className="pt-2 text-zinc-400 text-sm md:text-base font-medium opacity-75">
                  <span className="text-zinc-600 text-xs uppercase tracking-wider block mb-1">Coming Up:</span>
                  "{nextLine.text}"
                </div>
              )}
            </div>

            {/* Timeline Progress & Controls inside Stage */}
            <div className="relative z-10 space-y-3 pt-4 border-t border-zinc-800/60">
              {/* Scrub Bar */}
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = clickX / rect.width;
                  onSeek(ratio * totalDuration);
                }}
                className="w-full bg-zinc-800 h-2.5 rounded-full cursor-pointer relative overflow-hidden group"
              >
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 rounded-full transition-all duration-100"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-zinc-400">
                  {Math.floor(playbackTime / 60)}:{(playbackTime % 60 < 10 ? '0' : '') + Math.floor(playbackTime % 60)} / {Math.floor(totalDuration / 60)}:{(totalDuration % 60 < 10 ? '0' : '') + Math.floor(totalDuration % 60)}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={onRestart}
                    className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    title="Restart Track"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={isPlaying ? onPause : onPlay}
                    className="p-3.5 rounded-full bg-gradient-to-r from-fuchsia-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-fuchsia-600/30 hover:scale-105 active:scale-95 transition"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                </div>

                {/* Master Volume */}
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-zinc-400" />
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={fx.masterVolume}
                    onChange={(e) => handleFXChange({ masterVolume: parseFloat(e.target.value) })}
                    className="w-20 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling Lyrics Timeline Container */}
          <div 
            ref={lyricsContainerRef}
            className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 max-h-56 overflow-y-auto space-y-2 scroll-smooth"
          >
            {activeLyrics.map((line, idx) => {
              const isCurrent = idx === currentLineIndex;
              return (
                <div
                  key={line.id || idx}
                  ref={isCurrent ? activeLineRef : null}
                  onClick={() => onSeek(line.time)}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                    isCurrent
                      ? 'bg-fuchsia-950/60 border border-fuchsia-500/50 shadow-md text-white font-bold'
                      : 'hover:bg-zinc-800/40 text-zinc-400 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-500 w-10">
                      {Math.floor(line.time / 60)}:{(line.time % 60 < 10 ? '0' : '') + Math.floor(line.time % 60)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-300">
                      {line.section}
                    </span>
                    <span className="text-sm">{line.text}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-xs text-fuchsia-400 font-bold uppercase tracking-wider animate-pulse">
                      Singing Now
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Real-time Audio FX Rack Panel */}
        {showFXDrawer && (
          <div className="lg:col-span-4 bg-zinc-900/70 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-black text-white text-sm">Karaoke Audio FX Rack</h3>
                </div>
                <span className="text-[10px] font-mono rounded bg-cyan-950 text-cyan-300 px-2 py-0.5 border border-cyan-800">
                  DSP WebAudio
                </span>
              </div>

              <div className="space-y-5 mt-4">
                {/* 1. Vocal Remover / Center Canceler */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">Vocal Remover / Muter</div>
                      <div className="text-[11px] text-zinc-400">Attenuates center lead vocals</div>
                    </div>
                    <button
                      onClick={() => handleFXChange({ vocalRemover: !fx.vocalRemover })}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                        fx.vocalRemover
                          ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {fx.vocalRemover ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {fx.vocalRemover && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                        <span>Cancellation Strength</span>
                        <span>{Math.round(fx.vocalRemoverStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1.0"
                        step="0.05"
                        value={fx.vocalRemoverStrength}
                        onChange={(e) => handleFXChange({ vocalRemoverStrength: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Live Microphone Karaoke Monitor */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {fx.micEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-zinc-500" />}
                      <div>
                        <div className="font-bold text-white text-xs">Microphone Input</div>
                        <div className="text-[11px] text-zinc-400">Sing with live studio FX</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFXChange({ micEnabled: !fx.micEnabled })}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                        fx.micEnabled
                          ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {fx.micEnabled ? 'MIC ON' : 'MIC OFF'}
                    </button>
                  </div>

                  {fx.micEnabled && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                        <span>Mic Gain</span>
                        <span>{Math.round(fx.micVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={fx.micVolume}
                        onChange={(e) => handleFXChange({ micVolume: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Studio Reverb */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-300">
                    <span>Studio Reverb</span>
                    <span className="font-mono text-fuchsia-400">{Math.round(fx.reverbMix * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={fx.reverbMix}
                    onChange={(e) => handleFXChange({ reverbMix: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-fuchsia-500"
                  />
                </div>

                {/* 4. Echo / Delay */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-300">
                    <span>Echo & Delay</span>
                    <span className="font-mono text-cyan-400">{Math.round(fx.echoMix * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.05"
                    value={fx.echoMix}
                    onChange={(e) => handleFXChange({ echoMix: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* 5. Pitch Transpose */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-300">
                    <span>Key Pitch Shift</span>
                    <span className="font-mono text-indigo-400 font-bold">
                      {fx.pitchShiftSemitones > 0 ? `+${fx.pitchShiftSemitones}` : fx.pitchShiftSemitones} semitones
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[-3, -2, -1, 0, 1, 2, 3].map((semi) => (
                      <button
                        key={semi}
                        onClick={() => handleFXChange({ pitchShiftSemitones: semi })}
                        className={`flex-1 py-1 text-[10px] font-mono font-bold rounded-lg border transition ${
                          fx.pitchShiftSemitones === semi
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {semi > 0 ? `+${semi}` : semi}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. 3-Band EQ */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    3-Band Graphic EQ
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-zinc-400">
                    <div className="space-y-1">
                      <span>Low: {fx.eqLow}dB</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={fx.eqLow}
                        onChange={(e) => handleFXChange({ eqLow: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <span>Mid: {fx.eqMid}dB</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={fx.eqMid}
                        onChange={(e) => handleFXChange({ eqMid: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <span>High: {fx.eqHigh}dB</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={fx.eqHigh}
                        onChange={(e) => handleFXChange({ eqHigh: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recorded Audio Playback Download */}
            {recordedUrl && (
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                  <span>Karaoke Recording Ready!</span>
                  <a
                    href={recordedUrl}
                    download="karaoke-performance.webm"
                    className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition"
                    title="Download Performance"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
                <audio src={recordedUrl} controls className="w-full h-8" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
