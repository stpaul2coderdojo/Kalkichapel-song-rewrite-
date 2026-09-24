import React from 'react';
import { X, Download, FileText, Music, Check, Share2 } from 'lucide-react';
import { SongData, RegeneratedSong, LyricLine } from '../types/song';
import { audioEngine } from '../utils/audioEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: SongData;
  regeneratedSong: RegeneratedSong | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  song,
  regeneratedSong,
}) => {
  if (!isOpen) return null;

  const currentLyrics: LyricLine[] = regeneratedSong ? regeneratedSong.lyrics : song.lyrics;
  const currentTitle = regeneratedSong ? regeneratedSong.title : song.title;

  // Generate .lrc format
  const generateLrcContent = (): string => {
    let lrc = `[ti:${currentTitle}]\n[ar:${song.artist}]\n[al:Antigravity Karaoke Edition]\n`;
    currentLyrics.forEach((line) => {
      const min = Math.floor(line.time / 60);
      const sec = Math.floor(line.time % 60);
      const ms = Math.floor((line.time % 1) * 100);
      const timestamp = `[${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}.${ms < 10 ? '0' : ''}${ms}]`;
      lrc += `${timestamp}${line.text}\n`;
    });
    return lrc;
  };

  // Download text or LRC
  const handleDownloadText = (type: 'lrc' | 'txt') => {
    const filename = `${currentTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${type}`;
    let content = '';

    if (type === 'lrc') {
      content = generateLrcContent();
    } else {
      content = `${currentTitle} - ${song.artist}\n\n` + 
        currentLyrics.map((l) => `[${l.section}]\n${l.text}`).join('\n\n');
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download Audio WAV
  const handleDownloadAudio = () => {
    const wavBlob = audioEngine.exportWavBlob();
    if (!wavBlob) {
      alert('Audio stem buffer is not currently rendered. Play the track to initialize audio buffer.');
      return;
    }
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_master.wav`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Export Studio Assets</h3>
              <p className="text-xs text-zinc-400">{currentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options */}
        <div className="space-y-3">
          {/* Synchronized LRC */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-semibold text-white text-sm">Synced Karaoke Lyrics (.lrc)</div>
                <div className="text-[11px] text-zinc-400">
                  Standard timestamped format for karaoke machines & streaming apps
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDownloadText('lrc')}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs shadow-md transition"
            >
              Export .LRC
            </button>
          </div>

          {/* Plain Text Lyrics */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="font-semibold text-white text-sm">Song Sheet & Lyrics (.txt)</div>
                <div className="text-[11px] text-zinc-400">
                  Clean printed lyrics arranged by section & chords
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDownloadText('txt')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
            >
              Export .TXT
            </button>
          </div>

          {/* Audio Master WAV */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition">
            <div className="flex items-center gap-3">
              <Music className="w-5 h-5 text-fuchsia-400" />
              <div>
                <div className="font-semibold text-white text-sm">Master Audio Mix (.wav)</div>
                <div className="text-[11px] text-zinc-400">
                  Full fidelity uncompressed backing track and vocal stems
                </div>
              </div>
            </div>
            <button
              onClick={handleDownloadAudio}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs shadow-md transition"
            >
              Export .WAV
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
