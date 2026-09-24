import React from 'react';
import { Sparkles, Music2, Mic2, Sliders, Terminal, RotateCcw, Volume2 } from 'lucide-react';

interface NavbarProps {
  currentTab: 'input' | 'editor' | 'regenerate' | 'karaoke';
  onSelectTab: (tab: 'input' | 'editor' | 'regenerate' | 'karaoke') => void;
  hasSong: boolean;
  onOpenInspector: () => void;
  onReset: () => void;
  agentStatus: 'idle' | 'running' | 'ready';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  hasSong,
  onOpenInspector,
  onReset,
  agentStatus,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Antigravity Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-fuchsia-400 text-lg tracking-tight">
                Antigravity Song Studio
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Agentic v2.4
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                agentStatus === 'running' 
                  ? 'bg-amber-400 animate-ping' 
                  : agentStatus === 'ready' 
                  ? 'bg-emerald-400' 
                  : 'bg-zinc-500'
              }`} />
              <span className="text-zinc-300">Antigravity Agent</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 font-mono text-[11px]">antigravity-preview-05-2026</span>
            </p>
          </div>
        </div>

        {/* Workflow Navigation */}
        <nav className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl shadow-inner text-sm">
          <button
            onClick={() => onSelectTab('input')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              currentTab === 'input'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Music2 className="w-4 h-4" />
            <span>1. Song Source</span>
          </button>

          <button
            onClick={() => onSelectTab('editor')}
            disabled={!hasSong}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              !hasSong
                ? 'opacity-40 cursor-not-allowed text-zinc-500'
                : currentTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>2. Lyric Editor</span>
          </button>

          <button
            onClick={() => onSelectTab('regenerate')}
            disabled={!hasSong}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              !hasSong
                ? 'opacity-40 cursor-not-allowed text-zinc-500'
                : currentTab === 'regenerate'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3. Regenerate</span>
          </button>

          <button
            onClick={() => onSelectTab('karaoke')}
            disabled={!hasSong}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              !hasSong
                ? 'opacity-40 cursor-not-allowed text-zinc-500'
                : currentTab === 'karaoke'
                ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md shadow-fuchsia-600/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Mic2 className="w-4 h-4 text-fuchsia-400" />
            <span>4. Karaoke Studio</span>
          </button>
        </nav>

        {/* Utility Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenInspector}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition"
            title="Inspect Antigravity Agent sandbox execution and trace"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agent Logs</span>
          </button>

          {hasSong && (
            <button
              onClick={onReset}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
              title="Reset Song Session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
