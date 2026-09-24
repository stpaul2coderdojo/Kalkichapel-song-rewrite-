import React from 'react';
import { X, Terminal, Cpu, CheckCircle2, Loader2, ShieldCheck, Box, Activity } from 'lucide-react';
import { AgentThought } from '../types/song';

interface AgentInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  traces: AgentThought[];
  modelName?: string;
  isProcessing?: boolean;
}

export const AgentInspectorModal: React.FC<AgentInspectorModalProps> = ({
  isOpen,
  onClose,
  traces,
  modelName = 'antigravity-preview-05-2026',
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100">Antigravity Agent Inspector</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  Remote Sandbox
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">Agent: {modelName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sandbox Status Bar */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/80 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <Box className="w-3.5 h-3.5 text-indigo-400" />
            <span>Env: Google Linux Pod</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mode: Agentic Sandbox</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Status: {isProcessing ? 'Executing...' : 'Ready'}</span>
          </div>
        </div>

        {/* Execution Trace Timeline */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
            Execution Log & Tool Invocations
          </div>

          {traces.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Cpu className="w-8 h-8 mx-auto mb-2 text-zinc-600 animate-pulse" />
              <p>No agent interactions dispatched yet. Upload a song from your device to begin.</p>
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-zinc-800">
              {traces.map((trace, idx) => (
                <div key={trace.id || idx} className="relative flex items-start gap-3 pl-1">
                  <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700">
                    {trace.status === 'running' ? (
                      <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                    ) : trace.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-zinc-200">{trace.step}</span>
                      <div className="flex items-center gap-2">
                        {trace.tool && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                            tool: {trace.tool}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">{trace.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed font-sans">{trace.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-amber-400 text-xs py-2 px-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Antigravity Agent is reasoning and processing song stems...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-400">
          <span>Antigravity preview runtime: Gemini @google/genai 2.4.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
