import React, { useState } from 'react';
import { Sparkles, X, AlertTriangle, CheckCircle2, FileText, ArrowRight, Lightbulb, ShieldAlert, Layers } from 'lucide-react';
import { api } from '../../services/api';
import type { CodeExplanationResult } from '../../types';

interface ExplainCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath?: string;
  functionName?: string;
  initialSnippet?: string;
  repositoryId: string;
}

export const ExplainCodeModal: React.FC<ExplainCodeModalProps> = ({
  isOpen,
  onClose,
  filePath = '',
  functionName = '',
  initialSnippet = '',
  repositoryId,
}) => {
  const [snippet, setSnippet] = useState(initialSnippet);
  const [targetFile, setTargetFile] = useState(filePath);
  const [targetFunction, setTargetFunction] = useState(functionName);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<CodeExplanationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExplain = async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);

    try {
      const res = await api.explainCode({
        repositoryId,
        filePath: targetFile.trim() || undefined,
        functionName: targetFunction.trim() || undefined,
        codeSnippet: snippet.trim() || undefined,
      });

      setExplanation(res);
    } catch (err: any) {
      setError(err.message || 'Failed to explain code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#070D18] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Explain with AI
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Grounded RAG
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Deep architectural and functional explanation of codebase symbols
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Target inputs if not pre-filled */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Target File Path
              </label>
              <input
                type="text"
                value={targetFile}
                onChange={(e) => setTargetFile(e.target.value)}
                placeholder="e.g. src/services/authService.js"
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Function or Symbol Name (Optional)
              </label>
              <input
                type="text"
                value={targetFunction}
                onChange={(e) => setTargetFunction(e.target.value)}
                placeholder="e.g. authenticateUser"
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Code Snippet input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Code Snippet (Optional or Custom Selection)
            </label>
            <textarea
              rows={4}
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
              placeholder="Paste code or function body to analyze..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-indigo-200 font-mono text-xs placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Explain Button */}
          <button
            onClick={handleExplain}
            disabled={loading || (!targetFile && !targetFunction && !snippet)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-white" />
                Analyzing Grounded Repository Context...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Explanation
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Display */}
          {explanation && (
            <div className="space-y-4 pt-2">
              {explanation.success === false ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {explanation.explanation ||
                      "I couldn't find enough information in this codebase to explain this accurately."}
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Purpose */}
                  {explanation.purpose && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Purpose & Role
                      </h4>
                      <p className="text-xs text-gray-200 leading-relaxed">
                        {explanation.purpose}
                      </p>
                    </div>
                  )}

                  {/* Inputs & Outputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {explanation.inputs && explanation.inputs.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                          Inputs & Parameters
                        </h5>
                        <ul className="space-y-1">
                          {explanation.inputs.map((inItem, idx) => (
                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-emerald-400">•</span>
                              <span>{inItem}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explanation.outputs && explanation.outputs.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          Outputs & Return Value
                        </h5>
                        <ul className="space-y-1">
                          {explanation.outputs.map((outItem, idx) => (
                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-blue-400">•</span>
                              <span>{outItem}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Important Logic */}
                  {explanation.importantLogic && explanation.importantLogic.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Important Logic Steps
                      </h4>
                      <div className="space-y-2">
                        {explanation.importantLogic.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                            <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Potential Risks & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {explanation.potentialRisks && explanation.potentialRisks.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10">
                        <h5 className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Potential Risks
                        </h5>
                        <ul className="space-y-1.5">
                          {explanation.potentialRisks.map((risk, idx) => (
                            <li key={idx} className="text-xs text-rose-200/90 flex items-start gap-1.5">
                              <span className="text-rose-400">⚠️</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explanation.improvementSuggestions && explanation.improvementSuggestions.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-indigo-500/[0.03] border border-indigo-500/10">
                        <h5 className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" />
                          Improvement Suggestions
                        </h5>
                        <ul className="space-y-1.5">
                          {explanation.improvementSuggestions.map((sug, idx) => (
                            <li key={idx} className="text-xs text-indigo-200/90 flex items-start gap-1.5">
                              <span className="text-indigo-400">💡</span>
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Source References */}
                  {explanation.sourceReferences && explanation.sourceReferences.length > 0 && (
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                        Source References:
                      </span>
                      {explanation.sourceReferences.map((ref, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"
                        >
                          {ref.file} ({ref.lines})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplainCodeModal;
