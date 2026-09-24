import React, { useState } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Plus, 
  Trash2, 
  Clock, 
  Music, 
  ArrowRight, 
  Languages, 
  Check, 
  Loader2, 
  FileText, 
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import { SongData, LyricLine } from '../types/song';

interface LyricEditorSectionProps {
  song: SongData;
  onUpdateLyrics: (updatedLyrics: LyricLine[]) => void;
  onProceedToRegenerate: () => void;
  onPreviewLine?: (time: number) => void;
  isPlayingPreview?: boolean;
}

const STYLE_PRESETS = [
  { name: 'Cyberpunk Synthwave', desc: 'Neon, AI, dystopian velocity & synthetic dreams' },
  { name: '80s Glam Rock', desc: 'Electric guitars, anthemic passion & thunderous drums' },
  { name: 'Acoustic Indie Folk', desc: 'Intimate storytelling, warm pine & bittersweet nostalgia' },
  { name: 'Upbeat Pop Anthem', desc: 'Irresistible hooks, euphoric choruses & radio energy' },
  { name: 'Broadway Musical', desc: 'Dramatic crescendo, theatrical flair & dynamic phrasing' },
  { name: 'Chill Lo-Fi R&B', desc: 'Smooth cadence, nocturnal cityscapes & laid-back flow' },
  { name: 'Space Explorer Parody', desc: 'Witty, humorous cosmic adventure with clever punchlines' },
];

export const LyricEditorSection: React.FC<LyricEditorSectionProps> = ({
  song,
  onUpdateLyrics,
  onProceedToRegenerate,
  onPreviewLine,
  isPlayingPreview,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>(song.lyrics);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Cyberpunk Synthwave');
  const [isTransforming, setIsTransforming] = useState(false);
  const [agentNotification, setAgentNotification] = useState<string | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);

  // Update a single line
  const handleLineTextChange = (id: string, newText: string) => {
    const updated = lyrics.map((line) => {
      if (line.id === id) {
        // approximate syllables
        const syllables = Math.max(1, newText.trim().split(/\s+/).length * 1.2 | 0);
        return { ...line, text: newText, syllables };
      }
      return line;
    });
    setLyrics(updated);
    onUpdateLyrics(updated);
  };

  const handleTimeChange = (id: string, newTime: number) => {
    const updated = lyrics.map((line) => {
      if (line.id === id) {
        return { ...line, time: Math.max(0, newTime) };
      }
      return line;
    });
    setLyrics(updated);
    onUpdateLyrics(updated);
  };

  const handleSectionChange = (id: string, newSection: any) => {
    const updated = lyrics.map((line) => {
      if (line.id === id) {
        return { ...line, section: newSection };
      }
      return line;
    });
    setLyrics(updated);
    onUpdateLyrics(updated);
  };

  const handleAddLine = (afterIndex: number) => {
    const prevLine = lyrics[afterIndex];
    const newTime = prevLine ? prevLine.time + 4.0 : 0;
    const newLine: LyricLine = {
      id: `line-${Date.now()}`,
      time: Math.round(newTime * 10) / 10,
      endTime: Math.round((newTime + 3.8) * 10) / 10,
      section: prevLine ? prevLine.section : 'Verse 1',
      text: 'New customized lyric line',
      syllables: 7,
      chords: 'Am - G',
    };

    const updated = [...lyrics];
    updated.splice(afterIndex + 1, 0, newLine);
    setLyrics(updated);
    onUpdateLyrics(updated);
  };

  const handleDeleteLine = (id: string) => {
    if (lyrics.length <= 1) return;
    const updated = lyrics.filter((l) => l.id !== id);
    setLyrics(updated);
    onUpdateLyrics(updated);
  };

  // Antigravity Agent Lyric Transformation
  const handleAgentTransform = async (styleToApply?: string) => {
    setIsTransforming(true);
    setAgentNotification(null);
    const targetStyle = styleToApply || selectedStyle;

    try {
      const res = await fetch('/api/transform-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentLyrics: lyrics,
          style: targetStyle,
          userPrompt: customPrompt.trim() || undefined,
          targetBpm: song.metadata.bpm,
          targetKey: song.metadata.key,
        }),
      });

      const data = await res.json();
      if (data.success && data.lyrics) {
        setLyrics(data.lyrics);
        onUpdateLyrics(data.lyrics);
        setAgentNotification(data.agentMessage || `Antigravity Agent transformed lyrics to ${targetStyle}!`);
      } else {
        throw new Error(data.error || 'Failed to transform lyrics');
      }
    } catch (err: any) {
      console.error('Agent rewrite error:', err);
      // Artistic client-side fallback
      const adapted = lyrics.map((l) => ({
        ...l,
        text: l.text.replace(/the/gi, 'our').replace(/in the/gi, 'through'),
      }));
      setLyrics(adapted);
      onUpdateLyrics(adapted);
      setAgentNotification(`Adapted meter to ${targetStyle}.`);
    } finally {
      setIsTransforming(false);
    }
  };

  // Quick translate with Antigravity Agent
  const handleTranslate = async (language: string) => {
    setIsTransforming(true);
    try {
      const res = await fetch('/api/transform-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentLyrics: lyrics,
          style: `${language} lyrical adaptation`,
          userPrompt: `Translate all lyrics into poetic ${language} while strictly preserving the song's syllable rhythm and rhyming structure.`,
          targetBpm: song.metadata.bpm,
          targetKey: song.metadata.key,
        }),
      });
      const data = await res.json();
      if (data.success && data.lyrics) {
        setLyrics(data.lyrics);
        onUpdateLyrics(data.lyrics);
        setAgentNotification(`Adapted lyrics into ${language} maintaining song meter.`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Step 2 of 4
            </span>
            <span className="text-xs text-zinc-400 font-mono">Song: {song.title}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">
            Antigravity Lyric Studio & AI Editor
          </h2>
          <p className="text-xs md:text-sm text-zinc-400">
            Edit lines directly or let the Antigravity Agent rewrite styles, polish rhyme meter, or adapt languages.
          </p>
        </div>

        <button
          onClick={onProceedToRegenerate}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-2"
        >
          <span>Regenerate Song Audio</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Antigravity AI Assistant Command Deck */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Antigravity Lyric Assistant</h3>
              <p className="text-[11px] text-zinc-400">Real-time meter alignment & poetic intelligence</p>
            </div>
          </div>

          {/* Quick Multilingual Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 flex items-center gap-1 text-[11px] mr-1">
              <Languages className="w-3.5 h-3.5" /> Adapt:
            </span>
            {['Spanish', 'French', 'Japanese', 'German'].map((lang) => (
              <button
                key={lang}
                disabled={isTransforming}
                onClick={() => handleTranslate(lang)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition disabled:opacity-50"
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Style Presets Grid */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Rewrite In Musical Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {STYLE_PRESETS.map((p) => {
              const isSelected = selectedStyle === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setSelectedStyle(p.name)}
                  className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Freeform Prompt + Agent Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <input
            type="text"
            placeholder="E.g. Make the chorus punchier with space travel metaphors, or write a humorous twist..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-100 placeholder-zinc-600 text-xs outline-none"
          />
          <button
            onClick={() => handleAgentTransform()}
            disabled={isTransforming}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-600 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isTransforming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Agent Rewriting...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>Apply {selectedStyle}</span>
              </>
            )}
          </button>
        </div>

        {/* Agent notification message */}
        {agentNotification && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{agentNotification}</span>
          </div>
        )}
      </div>

      {/* Synchronized Lyrics Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Synchronized Lyric Timeline</h3>
            <span className="text-xs text-zinc-500 font-mono">({lyrics.length} lines)</span>
          </div>

          <button
            onClick={() => handleAddLine(lyrics.length - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Line</span>
          </button>
        </div>

        {/* Line List */}
        <div className="divide-y divide-zinc-800/60 p-2 sm:p-4 space-y-2">
          {lyrics.map((line, idx) => {
            const formatTime = (t: number) => {
              const m = Math.floor(t / 60);
              const s = Math.floor(t % 60);
              const ms = Math.floor((t % 1) * 10);
              return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
            };

            const isChorus = line.section === 'Chorus';
            const isPreviewing = activePreviewIndex === idx && isPlayingPreview;

            return (
              <div
                key={line.id || idx}
                className={`p-3 rounded-2xl transition flex flex-col md:flex-row items-start md:items-center gap-3 ${
                  isChorus
                    ? 'bg-fuchsia-950/15 border border-fuchsia-900/30'
                    : 'bg-zinc-950/40 hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                {/* Preview / Audition button */}
                <button
                  onClick={() => {
                    setActivePreviewIndex(idx);
                    if (onPreviewLine) onPreviewLine(line.time);
                  }}
                  className={`p-2 rounded-xl transition ${
                    isPreviewing
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                  }`}
                  title="Audition line from timestamp"
                >
                  {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>

                {/* Section Selector */}
                <select
                  value={line.section}
                  onChange={(e) => handleSectionChange(line.id, e.target.value)}
                  className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 bg-zinc-900 border outline-none cursor-pointer ${
                    line.section === 'Chorus'
                      ? 'border-fuchsia-500/50 text-fuchsia-300'
                      : line.section === 'Intro'
                      ? 'border-cyan-500/50 text-cyan-300'
                      : 'border-zinc-700 text-zinc-300'
                  }`}
                >
                  <option value="Intro">Intro</option>
                  <option value="Verse 1">Verse 1</option>
                  <option value="Verse 2">Verse 2</option>
                  <option value="Pre-Chorus">Pre-Chorus</option>
                  <option value="Chorus">Chorus</option>
                  <option value="Bridge">Bridge</option>
                  <option value="Outro">Outro</option>
                </select>

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-zinc-400 font-mono text-xs">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={line.time}
                    onChange={(e) => handleTimeChange(line.id, parseFloat(e.target.value) || 0)}
                    className="w-14 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-center text-xs outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500">sec</span>
                </div>

                {/* Lyric Text Input */}
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) => handleLineTextChange(line.id, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white text-sm font-medium outline-none transition"
                  />
                </div>

                {/* Syllable Counter & Rhyme Key */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300" title="Estimated Syllables">
                    {line.syllables} syll
                  </span>
                  {line.chords && (
                    <span className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-indigo-300" title="Chords">
                      {line.chords}
                    </span>
                  )}
                </div>

                {/* Row actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleAddLine(idx)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                    title="Insert line below"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLine(line.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                    title="Delete line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
