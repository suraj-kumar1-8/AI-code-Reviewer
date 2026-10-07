import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import type { AskMessage, GitHubRepo, IndexedRepository } from '../types';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  FolderGit2,
  FileCode2,
  Database,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Code2,
  Menu,
  ArrowRight,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Where is authentication handled?',
  'How are database connections and queries configured?',
  'What API routes are exposed by this project?',
  'Where and how is error handling implemented?',
  'What is the project structure and main application entry point?',
];

export const AskCodebase: React.FC = () => {
  const { owner: ownerParam, repo: repoParam } = useParams<{ owner?: string; repo?: string }>();
  const navigate = useNavigate();

  // Selected repository state
  const [owner, setOwner] = useState<string>(
    ownerParam || localStorage.getItem('lastViewedRepoOwner') || 'developit'
  );
  const [repo, setRepo] = useState<string>(
    repoParam || localStorage.getItem('lastViewedRepoName') || 'mitt'
  );

  // Available repositories
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [indexedRepos, setIndexedRepos] = useState<IndexedRepository[]>([]);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);

  // Indexing state
  const [indexingStatus, setIndexingStatus] = useState<{
    isIndexed: boolean;
    totalFiles?: number;
    totalChunks?: number;
    lastIndexedAt?: string;
  } | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingError, setIndexingError] = useState<string | null>(null);

  // Chat conversation state
  const [messages, setMessages] = useState<AskMessage[]>(() => {
    const saved = localStorage.getItem(`acr_chat_${owner}_${repo}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [expandedSnippetKey, setExpandedSnippetKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  // Save conversation per repo in localStorage
  useEffect(() => {
    if (owner && repo) {
      localStorage.setItem(`acr_chat_${owner}_${repo}`, JSON.stringify(messages));
    }
  }, [messages, owner, repo]);

  // Load repositories & current repo status
  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (ownerParam && repoParam) {
      setOwner(ownerParam);
      setRepo(repoParam);
    }
  }, [ownerParam, repoParam]);

  useEffect(() => {
    if (owner && repo) {
      checkStatus(owner, repo);
    }
  }, [owner, repo]);

  const loadRepositories = async () => {
    try {
      // 1. Fetch user GitHub repos
      const reposRes = await api.getRepos().catch(() => null);
      if (reposRes && reposRes.repositories) {
        setUserRepos(reposRes.repositories);
      }

      // 2. Fetch already indexed repositories
      const indexedRes = await api.getIndexedRepositories().catch(() => null);
      if (indexedRes && indexedRes.repositories) {
        setIndexedRepos(indexedRes.repositories);
      }
    } catch (err) {
      console.warn('[AskCodebase] Failed to fetch repositories list:', err);
    }
  };

  const checkStatus = async (o: string, r: string) => {
    try {
      setIndexingError(null);
      const status = await api.getCodebaseStatus({ owner: o, repo: r });
      setIndexingStatus(status);
    } catch (err: any) {
      setIndexingStatus({ isIndexed: false });
    }
  };

  const handleIndexCodebase = async (force = false) => {
    if (!owner || !repo) return;
    try {
      setIsIndexing(true);
      setIndexingError(null);
      const result = await api.indexCodebase({
        owner,
        repo,
        force,
      });

      setIndexingStatus({
        isIndexed: true,
        totalFiles: result.totalFiles,
        totalChunks: result.totalChunks,
        lastIndexedAt: result.lastIndexedAt,
      });

      // Refresh list of indexed repos
      const indexedRes = await api.getIndexedRepositories().catch(() => null);
      if (indexedRes && indexedRes.repositories) {
        setIndexedRepos(indexedRes.repositories);
      }
    } catch (err: any) {
      setIndexingError(err.message || 'Failed to index repository');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSelectRepo = (newOwner: string, newRepo: string) => {
    setOwner(newOwner);
    setRepo(newRepo);
    setIsRepoDropdownOpen(false);
    localStorage.setItem('lastViewedRepoOwner', newOwner);
    localStorage.setItem('lastViewedRepoName', newRepo);
    navigate(`/ask/${newOwner}/${newRepo}`);
  };

  const handleSendMessage = async (questionText?: string) => {
    const question = (questionText || inputQuestion).trim();
    if (!question || isAsking) return;

    setInputQuestion('');
    setAskError(null);

    const userMsg: AskMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      // Auto-index if not yet indexed
      if (!indexingStatus?.isIndexed) {
        await handleIndexCodebase(false);
      }

      const res = await api.askCodebase({
        owner,
        repo,
        repositoryId: `${owner}/${repo}`,
        question,
      });

      const assistantMsg: AskMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[AskCodebase] Question failed:', err);
      const errMsg: AskMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content:
          err.message ||
          'Failed to retrieve answer. Please make sure the repository is indexed and try again.',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
      setAskError(err.message);
    } finally {
      setIsAsking(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopySnippet = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem(`acr_chat_${owner}_${repo}`);
  };

  return (
    <div className="flex h-screen bg-[#060B13] text-gray-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        className={mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden md:flex'}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-6 border-b border-white/[0.08] bg-[#080E1A]/95 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Title & Repository Selector */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                  Ask Your Codebase
                  <Badge variant="primary" className="text-[10px] uppercase font-mono px-1.5 py-0.2">
                    RAG
                  </Badge>
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block truncate">
                  Semantic vector search with PostgreSQL pgvector & grounded Gemini AI
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Actions: Repository Dropdown & Index Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Repo Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-medium text-gray-200 transition-colors cursor-pointer"
              >
                <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="max-w-[140px] sm:max-w-[180px] truncate">
                  {owner}/{repo}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {isRepoDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0D1524] border border-white/10 shadow-2xl py-2 z-50 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Indexed Repositories
                  </div>
                  {indexedRepos.map((ir) => (
                    <button
                      key={ir.id}
                      onClick={() => handleSelectRepo(ir.owner, ir.name)}
                      className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white flex items-center justify-between transition-colors"
                    >
                      <span className="truncate font-mono">{ir.full_name}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {ir.total_chunks} chunks
                      </span>
                    </button>
                  ))}

                  {userRepos.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-t border-white/5">
                        GitHub Repositories
                      </div>
                      {userRepos.slice(0, 10).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSelectRepo(r.owner, r.name)}
                          className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white flex items-center justify-between transition-colors"
                        >
                          <span className="truncate">{r.full_name}</span>
                          <span className="text-[10px] text-gray-400">{r.language}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Indexing Action Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleIndexCodebase(true)}
              disabled={isIndexing}
              className="text-xs flex items-center gap-1.5 border-white/10 hover:border-indigo-500/40"
              title="Re-index repository vector embeddings in pgvector"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden sm:inline">
                {isIndexing ? 'Indexing...' : indexingStatus?.isIndexed ? 'Re-index' : 'Index Codebase'}
              </span>
            </Button>
          </div>
        </header>

        {/* Index Status Sub-bar */}
        <div className="px-4 sm:px-6 py-2 bg-[#091120] border-b border-white/[0.06] flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  indexingStatus?.isIndexed ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-medium text-gray-300">
                {indexingStatus?.isIndexed ? 'Indexed & Ready' : 'Not Indexed Yet'}
              </span>
            </span>

            {indexingStatus?.isIndexed && (
              <span className="hidden sm:inline text-gray-400">
                • {indexingStatus.totalFiles} files • {indexingStatus.totalChunks} chunks in pgvector
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer text-[11px]"
              >
                Clear History
              </button>
            )}
            <Link
              to={`/review/${owner}/${repo}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 text-[11px]"
            >
              <span>Code Review</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Indexing Error Banner */}
        {indexingError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Indexing failed: {indexingError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleIndexCodebase(true)}
              className="text-[11px] h-7 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Chat Stream Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.length === 0 ? (
            /* Empty State / Welcome Screen */
            <div className="max-w-2xl mx-auto py-8 sm:py-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Bot className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Ask anything about <span className="text-indigo-400">{owner}/{repo}</span>
              </h2>
              <p className="text-sm text-gray-400 max-w-lg mx-auto mb-8">
                Your question is converted into high-dimensional vector embeddings, matched against
                indexed code chunks in PostgreSQL + pgvector, and answered exclusively using verified source context.
              </p>

              {/* Suggested Questions */}
              <div className="text-left">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Suggested Questions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="p-3 rounded-xl bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/30 text-left text-xs sm:text-sm text-gray-300 hover:text-white transition-all duration-150 cursor-pointer flex items-center justify-between group"
                    >
                      <span className="line-clamp-2">{q}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Messages List */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* AI Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-none ml-auto'
                        : msg.isError
                        ? 'bg-rose-950/30 border border-rose-500/30 text-rose-200 rounded-bl-none'
                        : 'bg-[#0E1726] border border-white/[0.08] text-gray-100 rounded-bl-none'
                    }`}
                  >
                    {/* Timestamp */}
                    <div className="flex items-center justify-between gap-3 mb-1.5 text-[10px] text-gray-400">
                      <span className="font-semibold text-gray-300">
                        {msg.role === 'user' ? 'You' : 'Codebase AI'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Message Content */}
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    {/* Grounded Sources Section */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <FileCode2 className="w-3.5 h-3.5" />
                            <span>Sources Used ({msg.sources.length})</span>
                          </span>
                        </div>

                        <div className="space-y-2">
                          {msg.sources.map((src, sIdx) => {
                            const snippetKey = `${msg.id}-${sIdx}`;
                            const isExpanded = expandedSnippetKey === snippetKey;

                            return (
                              <div
                                key={sIdx}
                                className="rounded-xl bg-[#090F1A] border border-white/5 overflow-hidden text-xs"
                              >
                                <div className="p-2.5 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="font-mono text-gray-200 font-medium truncate">
                                      {src.file}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                      Lines {src.startLine}–{src.endLine}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                                      {Math.round(src.similarity * 100)}% match
                                    </span>
                                    <button
                                      onClick={() =>
                                        setExpandedSnippetKey(isExpanded ? null : snippetKey)
                                      }
                                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                      title={isExpanded ? 'Hide snippet' : 'View snippet'}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Code Snippet Viewer */}
                                {isExpanded && src.snippet && (
                                  <div className="border-t border-white/5 bg-[#050A12] p-3">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-[10px] text-gray-400 font-mono">
                                      <span>Language: {src.language}</span>
                                      <button
                                        onClick={() => handleCopySnippet(snippetKey, src.snippet!)}
                                        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                      >
                                        {copiedKey === snippetKey ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-400" />
                                            <span className="text-emerald-400">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto leading-relaxed max-h-56">
                                      <code>{src.snippet}</code>
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 text-white mt-1 shadow-sm">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Assistant Loading State */}
              {isAsking && (
                <div className="flex gap-3.5 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-[#0E1726] border border-white/[0.08] rounded-2xl rounded-bl-none p-4 max-w-[80%]">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {isIndexing ? 'Indexing repository chunks...' : 'Searching pgvector & analyzing code...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Question Input Footer */}
        <div className="p-4 sm:p-5 bg-[#080E1A]/95 border-t border-white/[0.08] backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto">
            {askError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{askError}</span>
              </div>
            )}

            <div className="relative flex items-center rounded-2xl bg-[#0E1726] border border-white/10 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-lg">
              <textarea
                ref={inputRef}
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${owner}/${repo}... (e.g. "Where is authentication handled?")`}
                rows={1}
                disabled={isAsking}
                className="w-full py-3.5 pl-4 pr-14 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none resize-none min-h-[48px] max-h-32"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputQuestion.trim() || isAsking}
                aria-label="Send question"
                className={`absolute right-2 p-2.5 rounded-xl transition-all cursor-pointer ${
                  inputQuestion.trim() && !isAsking
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'text-gray-500 hover:text-gray-400 bg-white/5 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-1">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-400" />
                <span>Grounded with pgvector HNSW search</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskCodebase;
