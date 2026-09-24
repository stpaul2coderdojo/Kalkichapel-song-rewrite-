/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SongInputSection } from './components/SongInputSection';
import { LyricEditorSection } from './components/LyricEditorSection';
import { SongRegeneratorSection } from './components/SongRegeneratorSection';
import { KaraokeStage } from './components/KaraokeStage';
import { AgentInspectorModal } from './components/AgentInspectorModal';
import { ExportModal } from './components/ExportModal';
import { SongData, RegeneratedSong, LyricLine, AgentThought } from './types/song';
import { 
  ensureStarterDeviceSongs, 
  getAllDeviceSongs, 
  convertStoredToSongData,
  updateDeviceSongLyrics
} from './utils/deviceSongStorage';
import { audioEngine } from './utils/audioEngine';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'input' | 'editor' | 'regenerate' | 'karaoke'>('input');
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [regeneratedSong, setRegeneratedSong] = useState<RegeneratedSong | null>(null);
  const [agentTraces, setAgentTraces] = useState<AgentThought[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'running' | 'ready'>('idle');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  // Playback state
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePlayingType, setActivePlayingType] = useState<'original' | 'regenerated' | null>(null);

  // Initialize with the uploaded song from device storage
  useEffect(() => {
    async function initDeviceSong() {
      try {
        const storedSongs = await ensureStarterDeviceSongs();
        const nonNeon = storedSongs.filter(s => !s.title.toLowerCase().includes('neon gravity'));
        if (nonNeon.length > 0) {
          const song = convertStoredToSongData(nonNeon[0]);
          handleSongSelected(song);
        } else {
          setCurrentSong(null);
          setCurrentTab('input');
        }
      } catch (e) {
        console.error('Error initializing device song:', e);
      }
    }
    initDeviceSong();
  }, []);

  // Hook up audio engine time tracking
  useEffect(() => {
    audioEngine.onTimeUpdate((time) => {
      setPlaybackTime(time);
    });

    audioEngine.onEnded(() => {
      setIsPlaying(false);
      setPlaybackTime(0);
      setActivePlayingType(null);
    });
  }, []);

  // When a song is selected / loaded
  const handleSongSelected = useCallback(async (song: SongData) => {
    setCurrentSong(song);
    setAgentTraces(song.agentTrace || []);
    setAgentStatus('ready');
    setRegeneratedSong(null);
    setIsPlaying(false);
    setActivePlayingType(null);
    audioEngine.stop();

    // Prepare audio track in audio engine
    if (song.audioUrl && song.audioUrl.startsWith('blob:')) {
      // Local uploaded file
      try {
        await audioEngine.loadAudio(song.audioUrl);
      } catch (e) {
        audioEngine.generateProceduralTrack(
          song.metadata.bpm,
          song.metadata.key,
          song.duration,
          song.lyrics,
          song.metadata.vocalStyle,
          true
        );
      }
    } else if (song.audioUrl && song.audioUrl.length > 5) {
      try {
        await audioEngine.loadAudio(song.audioUrl);
      } catch (e) {
        audioEngine.generateProceduralTrack(
          song.metadata.bpm,
          song.metadata.key,
          song.duration,
          song.lyrics,
          song.metadata.vocalStyle,
          true
        );
      }
    } else {
      // Generate procedural track with rich singing vocals
      audioEngine.generateProceduralTrack(
        song.metadata.bpm,
        song.metadata.key,
        song.duration,
        song.lyrics,
        song.metadata.vocalStyle,
        true
      );
    }
  }, []);

  // Handle lyric edits
  const handleUpdateLyrics = (updatedLyrics: LyricLine[]) => {
    if (!currentSong) return;
    const updated = {
      ...currentSong,
      lyrics: updatedLyrics,
    };
    setCurrentSong(updated);

    // Save changes to device storage
    if (currentSong.id) {
      updateDeviceSongLyrics(currentSong.id, updatedLyrics).catch(console.warn);
    }

    if (regeneratedSong) {
      setRegeneratedSong({
        ...regeneratedSong,
        lyrics: updatedLyrics,
      });
    }
  };

  // Play Original
  const handlePlayOriginal = () => {
    if (!currentSong) return;
    if (activePlayingType !== 'original') {
      if (currentSong.audioUrl && currentSong.audioUrl.startsWith('blob:')) {
        audioEngine.loadAudio(currentSong.audioUrl).catch(() => {
          audioEngine.generateProceduralTrack(
            currentSong.metadata.bpm,
            currentSong.metadata.key,
            currentSong.duration,
            currentSong.lyrics,
            currentSong.metadata.vocalStyle,
            true
          );
        });
      } else {
        audioEngine.generateProceduralTrack(
          currentSong.metadata.bpm,
          currentSong.metadata.key,
          currentSong.duration,
          currentSong.lyrics,
          currentSong.metadata.vocalStyle,
          true
        );
      }
      setActivePlayingType('original');
    }
    audioEngine.play();
    setIsPlaying(true);
  };

  // Play Regenerated
  const handlePlayRegenerated = (regen: RegeneratedSong) => {
    if (activePlayingType !== 'regenerated') {
      if (regen.audioUrl) {
        audioEngine.loadAudio(regen.audioUrl).catch(() => {
          audioEngine.generateProceduralTrack(
            regen.bpm,
            regen.key,
            regen.duration,
            regen.lyrics,
            regen.vocalStyle,
            true
          );
        });
      } else {
        audioEngine.generateProceduralTrack(
          regen.bpm,
          regen.key,
          regen.duration,
          regen.lyrics,
          regen.vocalStyle,
          true
        );
      }
      setActivePlayingType('regenerated');
    }
    audioEngine.play();
    setIsPlaying(true);
  };

  // Pause
  const handlePause = () => {
    audioEngine.pause();
    setIsPlaying(false);
  };

  // Seek
  const handleSeek = (time: number) => {
    setPlaybackTime(time);
    audioEngine.seek(time);
  };

  // Restart
  const handleRestart = () => {
    audioEngine.seek(0);
    setPlaybackTime(0);
    audioEngine.play();
    setIsPlaying(true);
  };

  // Preview line from lyric editor
  const handlePreviewLine = (time: number) => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      if (!activePlayingType && currentSong) {
        audioEngine.generateProceduralTrack(currentSong.metadata.bpm, currentSong.metadata.key, currentSong.duration);
        setActivePlayingType('original');
      }
      audioEngine.seek(time);
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  // Reset session
  const handleReset = async () => {
    audioEngine.stop();
    setIsPlaying(false);
    setPlaybackTime(0);
    setActivePlayingType(null);
    try {
      const stored = await getAllDeviceSongs();
      if (stored.length > 0) {
        handleSongSelected(convertStoredToSongData(stored[0]));
      } else {
        setCurrentSong(null);
      }
    } catch {
      setCurrentSong(null);
    }
    setCurrentTab('input');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        hasSong={!!currentSong}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onReset={handleReset}
        agentStatus={agentStatus}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {currentTab === 'input' && (
          <SongInputSection
            onSongSelected={handleSongSelected}
            isLoading={isLoadingSong}
            onProceedToEditor={() => setCurrentTab('editor')}
            currentSong={currentSong}
          />
        )}

        {currentTab === 'editor' && currentSong && (
          <LyricEditorSection
            song={currentSong}
            onUpdateLyrics={handleUpdateLyrics}
            onProceedToRegenerate={() => setCurrentTab('regenerate')}
            onPreviewLine={handlePreviewLine}
            isPlayingPreview={isPlaying}
          />
        )}

        {currentTab === 'regenerate' && currentSong && (
          <SongRegeneratorSection
            song={currentSong}
            regeneratedSong={regeneratedSong}
            onSongRegenerated={(regen) => {
              setRegeneratedSong(regen);
              setAgentTraces((prev) => [
                ...prev,
                {
                  id: `regen-trace-${Date.now()}`,
                  timestamp: new Date().toISOString().substring(11, 19),
                  step: 'Antigravity Song Synthesis Complete',
                  tool: 'MultiTrackAudioMixer',
                  status: 'completed',
                  details: `Regenerated vocal stems in ${regen.vocalStyle} with ${regen.arrangementStyle} backing at ${regen.bpm} BPM.`,
                },
              ]);
            }}
            onProceedToKaraoke={() => {
              // Ensure audio engine has track loaded for karaoke
              if (regeneratedSong) {
                audioEngine.generateProceduralTrack(
                  regeneratedSong.bpm, 
                  regeneratedSong.key, 
                  regeneratedSong.duration,
                  regeneratedSong.lyrics,
                  regeneratedSong.vocalStyle,
                  true
                );
              } else if (currentSong.audioUrl && currentSong.audioUrl.startsWith('blob:')) {
                audioEngine.loadAudio(currentSong.audioUrl).catch(() => {
                  audioEngine.generateProceduralTrack(
                    currentSong.metadata.bpm, 
                    currentSong.metadata.key, 
                    currentSong.duration,
                    currentSong.lyrics,
                    currentSong.metadata.vocalStyle,
                    true
                  );
                });
              } else {
                audioEngine.generateProceduralTrack(
                  currentSong.metadata.bpm, 
                  currentSong.metadata.key, 
                  currentSong.duration,
                  currentSong.lyrics,
                  currentSong.metadata.vocalStyle,
                  true
                );
              }
              setCurrentTab('karaoke');
            }}
            onPlayOriginal={handlePlayOriginal}
            onPlayRegenerated={handlePlayRegenerated}
            onPause={handlePause}
            isPlaying={isPlaying}
            activePlayingType={activePlayingType}
            playbackTime={playbackTime}
          />
        )}

        {currentTab === 'karaoke' && currentSong && (
          <KaraokeStage
            song={currentSong}
            regeneratedSong={regeneratedSong}
            playbackTime={playbackTime}
            isPlaying={isPlaying}
            onPlay={() => {
              if (!activePlayingType) {
                if (regeneratedSong) {
                  audioEngine.generateProceduralTrack(
                    regeneratedSong.bpm, 
                    regeneratedSong.key, 
                    regeneratedSong.duration,
                    regeneratedSong.lyrics,
                    regeneratedSong.vocalStyle,
                    true
                  );
                  setActivePlayingType('regenerated');
                } else if (currentSong.audioUrl && currentSong.audioUrl.startsWith('blob:')) {
                  audioEngine.loadAudio(currentSong.audioUrl).catch(() => {
                    audioEngine.generateProceduralTrack(
                      currentSong.metadata.bpm, 
                      currentSong.metadata.key, 
                      currentSong.duration,
                      currentSong.lyrics,
                      currentSong.metadata.vocalStyle,
                      true
                    );
                  });
                  setActivePlayingType('original');
                } else {
                  audioEngine.generateProceduralTrack(
                    currentSong.metadata.bpm, 
                    currentSong.metadata.key, 
                    currentSong.duration,
                    currentSong.lyrics,
                    currentSong.metadata.vocalStyle,
                    true
                  );
                  setActivePlayingType('original');
                }
              }
              audioEngine.play();
              setIsPlaying(true);
            }}
            onPause={handlePause}
            onSeek={handleSeek}
            onRestart={handleRestart}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        )}
      </main>

      {/* Antigravity Agent Inspector Modal */}
      <AgentInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        traces={agentTraces}
        modelName="antigravity-preview-05-2026"
        isProcessing={isLoadingSong}
      />

      {/* Export Synchronized Lyrics & Audio Modal */}
      {currentSong && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          song={currentSong}
          regeneratedSong={regeneratedSong}
        />
      )}
    </div>
  );
}
