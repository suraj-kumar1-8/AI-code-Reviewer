import React, { useState } from 'react';
import type { CodeIssue, SourceFile } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Check,
  Copy,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Columns,
  Rows,
  X,
} from 'lucide-react';

interface CodeViewerProps {
  issue: CodeIssue;
  sourceFile?: SourceFile;
  onClose?: () => void;
  isModal?: boolean;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  issue,
  sourceFile,
  onClose,
  isModal = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewLayout, setViewLayout] = useState<'split' | 'stacked'>('split');
  const [applied, setApplied] = useState(false);

  // Extract source lines around the issue line (context radius 5)
  const sourceLines = React.useMemo(() => {
    if (sourceFile?.content) {
      const allLines = sourceFile.content.split('\n');
      const targetLine = issue.line || issue.lineNumber || 1;
      const startLine = Math.max(1, targetLine - 5);
      const endLine = Math.min(allLines.length, targetLine + 5);

      return allLines.slice(startLine - 1, endLine).map((text, idx) => ({
        number: startLine + idx,
        text,
        isTarget: startLine + idx === targetLine,
      }));
    }

    // Fallback if full file content isn't available: parse codeSnippet
    if (issue.codeSnippet) {
      const snippetLines = issue.codeSnippet.split('\n');
      const targetLine = issue.line || issue.lineNumber || 1;
      return snippetLines.map((text, idx) => ({
        number: targetLine + idx,
        text,
        isTarget: idx === 0,
      }));
    }

    return [
      {
        number: issue.line || 1,
        text: '// Source line context unavailable',
        isTarget: true,
      },
    ];
  }, [sourceFile, issue]);

  const handleCopyFix = () => {
    const textToCopy = issue.suggestedFix || issue.fixedCodeSnippet || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (String(severity).toLowerCase()) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const content = (
    <div className="flex flex-col space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs sm:text-sm font-semibold text-white truncate">
                {issue.file || issue.filePath}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-indigo-300 shrink-0">
                Line {issue.line || issue.lineNumber}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">{issue.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Split / Stacked Layout Switcher (hidden on small mobile) */}
          <div className="hidden sm:flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setViewLayout('split')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-all cursor-pointer ${
                viewLayout === 'split'
                  ? 'bg-indigo-600/60 text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Side-by-side comparison"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-[11px]">Side-by-Side</span>
            </button>
            <button
              onClick={() => setViewLayout('stacked')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-all cursor-pointer ${
                viewLayout === 'stacked'
                  ? 'bg-indigo-600/60 text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Stacked view"
            >
              <Rows className="w-3.5 h-3.5" />
              <span className="text-[11px]">Stacked</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyFix}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {copied ? 'Copied!' : 'Copy Fix'}
          </Button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close code viewer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Impact & Diagnosis Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/25 space-y-1">
          <div className="flex items-center gap-1.5 text-red-400 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Impact Analysis</span>
          </div>
          <p className="text-red-200/90 leading-relaxed text-[11px]">
            {issue.impact || 'Presents security risks or runtime instability if not remediated.'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Remediation Guidance</span>
          </div>
          <p className="text-emerald-200/90 leading-relaxed text-[11px]">
            {issue.recommendation}
          </p>
        </div>
      </div>

      {/* Code Comparison Panels */}
      <div
        className={`grid gap-4 ${
          viewLayout === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* Left: Original Source Code Context */}
        <div className="rounded-xl border border-red-500/30 bg-[#080F1A] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-red-950/30 border-b border-red-500/20 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-red-300 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Source Code (Problematic Line {issue.line})
            </span>
            <Badge variant={getSeverityBadgeVariant(issue.severity)} size="sm" className="text-[9px] uppercase">
              {issue.severity}
            </Badge>
          </div>

          <div className="p-3 font-mono text-xs overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed select-text">
            {sourceLines.map((line) => (
              <div
                key={line.number}
                className={`flex items-start gap-3 py-0.5 px-2 rounded -mx-1 transition-colors ${
                  line.isTarget
                    ? 'bg-red-500/20 border-l-2 border-red-500 text-red-100 font-medium'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <span className="w-8 shrink-0 text-right select-none text-[11px] font-mono opacity-50">
                  {line.number}
                </span>
                <pre className="whitespace-pre overflow-x-visible font-mono text-[12px]">{line.text || ' '}</pre>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Suggested Fix */}
        <div className="rounded-xl border border-emerald-500/30 bg-[#080F1A] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Suggested Refactored Fix
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Ready to Apply
            </span>
          </div>

          <div className="p-4 font-mono text-xs overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed bg-emerald-950/10 select-text">
            <pre className="text-emerald-200 text-[12px] whitespace-pre-wrap leading-relaxed">
              {issue.suggestedFix || issue.fixedCodeSnippet || '// No code fix provided.'}
            </pre>
          </div>
        </div>
      </div>

      {/* Applied notification feedback */}
      {applied && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Refactor patch copied to clipboard! Pull Request integration is queued for future release.</span>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-gray-500 font-mono">
          Inspection grounded in repository source files
        </span>

        <div className="flex items-center gap-2">
          {isModal && onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Copy className="w-3.5 h-3.5" />}
            onClick={() => {
              handleCopyFix();
              setApplied(true);
              setTimeout(() => setApplied(false), 3000);
            }}
          >
            Copy Refactor Code
          </Button>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-4xl bg-[#0E1626] border border-white/15 rounded-2xl p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#080F1A]/90 border border-white/10 mt-3">
      {content}
    </div>
  );
};

export default CodeViewer;
