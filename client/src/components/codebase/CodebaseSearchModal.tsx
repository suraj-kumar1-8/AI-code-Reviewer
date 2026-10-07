import React, { useState } from 'react';
import { Search, X, Code, Terminal, FileCode, Tag, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import { api } from '../../services/api';
import type { CodebaseSearchResult } from '../../types';

interface CodebaseSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId: string;
  onExplainCode?: (file: string, snippet: string) => void;
}

const SEARCH_TYPES = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'filename', label: 'File', icon: FileCode },
  { id: 'function', label: 'Function', icon: Code },
  { id: 'api', label: 'API Endpoint', icon: Terminal },
  { id: 'class', label: 'Class', icon: Tag },
  { id: 'symbol', label: 'Symbol', icon: Tag },
  { id: 'keyword', label: 'Keyword', icon: Search },
];

export const CodebaseSearchModal: React.FC<CodebaseSearchModalProps> = ({
  isOpen,
  onClose,
  repositoryId,
  onExplainCode,
}) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CodebaseSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await api.searchCodebase({
        repositoryId,
        query: query.trim(),
        type,
      });
      setResults(res.results || []);
    } catch (err: any) {
      setError(err.message || 'Failed to search codebase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#070D18] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Codebase Intelligence Search</h2>
                <p className="text-xs text-gray-400">
                  Search across indexed symbols, routes, classes, and code chunks in {repositoryId}
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

          {/* Search Input Bar */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search functions, APIs, symbols (e.g. 'auth', 'on', 'express', '/api/')..."
                className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {SEARCH_TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </form>
        </div>

        {/* Results Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-xs">
              No matching symbols or code chunks found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {results.map((res, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-white">
                    {res.file}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    {res.location}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {res.matchType}
                  </span>
                </div>

                {onExplainCode && (
                  <button
                    onClick={() => onExplainCode(res.file, res.relevantCode)}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-lg border border-indigo-500/20 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Sparkles className="w-3 h-3" />
                    Explain with AI
                  </button>
                )}
              </div>

              {/* Why it matches */}
              <p className="text-xs text-indigo-300/80 font-medium flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {res.whyMatches}
              </p>

              {/* Relevant Code Snippet */}
              <pre className="text-xs font-mono text-gray-300 bg-black/50 p-3 rounded-lg border border-white/10 overflow-x-auto leading-relaxed">
                {res.relevantCode}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CodebaseSearchModal;
