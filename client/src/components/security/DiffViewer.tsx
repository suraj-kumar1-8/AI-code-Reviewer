import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, Sparkles, Split, AlignJustify } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DiffViewerProps {
  beforeCode: string;
  afterCode: string;
  diff?: string;
  explanation?: string;
  recommendedFix?: string;
  confidence?: string;
  model?: string;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  beforeCode,
  afterCode,
  diff,
  explanation,
  recommendedFix,
  confidence = 'HIGH',
  model,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(afterCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy
      const el = document.createElement('textarea');
      el.value = afterCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const beforeLines = (beforeCode || '').split('\n');
  const afterLines = (afterCode || '').split('\n');

  // Parse unified diff lines if available
  const unifiedLines = (diff || '')
    .split('\n')
    .filter((l) => !l.startsWith('---') && !l.startsWith('+++'));

  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-[#0A101D] overflow-hidden shadow-2xl transition-all',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0D1527] border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white tracking-wide uppercase">AI Remediation Fix</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase',
                  confidence === 'HIGH'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : confidence === 'MEDIUM'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                )}
              >
                {confidence} Confidence
              </span>
              {model && (
                <span className="text-[10px] font-mono text-gray-400">via {model}</span>
              )}
            </div>
          </div>
        </div>

        {/* View toggle & Copy button */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs font-medium',
                viewMode === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              )}
              title="Side-by-side Before/After diff"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs font-medium',
                viewMode === 'unified' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              )}
              title="Unified diff format"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
          </div>

          {/* Copy Fix Button */}
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer',
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/10 hover:bg-white/15 text-white border-white/10 hover:border-white/20'
            )}
            title="Copy safe remediated code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Fix!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-300" />
                <span>Copy Fix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Explanation & Recommendation Banner */}
      {(explanation || recommendedFix) && (
        <div className="px-4 py-2.5 bg-indigo-950/20 border-b border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed space-y-1">
          {explanation && (
            <div>
              <strong className="text-indigo-300 font-semibold mr-1.5">Explanation:</strong>
              {explanation}
            </div>
          )}
          {recommendedFix && (
            <div>
              <strong className="text-emerald-300 font-semibold mr-1.5">Best Practice Fix:</strong>
              {recommendedFix}
            </div>
          )}
        </div>
      )}

      {/* Diff Code Container */}
      <div className="p-3 bg-[#060A12] overflow-x-auto font-mono text-xs leading-relaxed max-h-[380px] overflow-y-auto">
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-[600px]">
            {/* Before Code (Vulnerable) */}
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 overflow-hidden">
              <div className="px-3 py-1.5 bg-rose-950/30 border-b border-rose-500/20 text-[11px] font-semibold text-rose-300 flex items-center justify-between">
                <span>Before (Vulnerable)</span>
                <span className="text-[10px] text-rose-400/80 font-mono">- {beforeLines.length} lines</span>
              </div>
              <div className="p-2.5 divide-y divide-rose-500/5">
                {beforeLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3 py-0.5 text-rose-200/90 hover:bg-rose-500/10 rounded px-1">
                    <span className="select-none text-rose-500/50 w-6 text-right shrink-0">{idx + 1}</span>
                    <span className="select-none text-rose-400/60 mr-1">-</span>
                    <span className="whitespace-pre overflow-x-auto flex-1 font-mono">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After Code (Remediated) */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 overflow-hidden">
              <div className="px-3 py-1.5 bg-emerald-950/30 border-b border-emerald-500/20 text-[11px] font-semibold text-emerald-300 flex items-center justify-between">
                <span>After (Remediated Fix)</span>
                <span className="text-[10px] text-emerald-400/80 font-mono">+ {afterLines.length} lines</span>
              </div>
              <div className="p-2.5 divide-y divide-emerald-500/5">
                {afterLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3 py-0.5 text-emerald-200/90 hover:bg-emerald-500/10 rounded px-1">
                    <span className="select-none text-emerald-500/50 w-6 text-right shrink-0">{idx + 1}</span>
                    <span className="select-none text-emerald-400 mr-1">+</span>
                    <span className="whitespace-pre overflow-x-auto flex-1 font-mono">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Unified Diff View */
          <div className="rounded-lg border border-white/[0.08] bg-[#070D18] overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/[0.08] text-[11px] font-semibold text-gray-300">
              Unified Diff
            </div>
            <div className="p-2.5">
              {unifiedLines.length > 0 ? (
                unifiedLines.map((line, idx) => {
                  const isAdd = line.startsWith('+');
                  const isDel = line.startsWith('-');
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex gap-3 py-0.5 px-2 rounded font-mono',
                        isAdd
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : isDel
                          ? 'bg-rose-500/10 text-rose-300'
                          : 'text-gray-400'
                      )}
                    >
                      <span className="select-none w-6 text-right text-gray-600 shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre overflow-x-auto flex-1">{line || ' '}</span>
                    </div>
                  );
                })
              ) : (
                <>
                  {beforeLines.map((line, idx) => (
                    <div key={`b-${idx}`} className="flex gap-3 py-0.5 px-2 bg-rose-500/10 text-rose-300 rounded font-mono">
                      <span className="select-none w-6 text-right text-rose-500/50 shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre overflow-x-auto flex-1 font-mono">- {line}</span>
                    </div>
                  ))}
                  {afterLines.map((line, idx) => (
                    <div key={`a-${idx}`} className="flex gap-3 py-0.5 px-2 bg-emerald-500/10 text-emerald-300 rounded font-mono">
                      <span className="select-none w-6 text-right text-emerald-500/50 shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre overflow-x-auto flex-1 font-mono">+ {line}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Advisory Footer */}
      <div className="px-4 py-2.5 bg-[#080E1C] border-t border-white/[0.08] flex items-center gap-2 text-[11px] text-gray-400">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong>Advisory Notice:</strong> This fix is an AI suggestion. Antigravity never automatically commits or mutates your repository.
        </span>
      </div>
    </div>
  );
};

export default DiffViewer;
