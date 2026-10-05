import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Copy, Check } from 'lucide-react';

export const IssuePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'security' | 'bugs' | 'performance' | 'quality'>('security');
  const [copied, setCopied] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  const categories = [
    { id: 'security', label: 'Security', count: 3 },
    { id: 'bugs', label: 'Bugs', count: 2 },
    { id: 'performance', label: 'Performance', count: 2 },
    { id: 'quality', label: 'Quality', count: 3 },
  ];

  const handleCopy = () => {
    navigator.clipboard?.writeText(
      'const query = "SELECT * FROM users WHERE id = ?";\nconst result = await db.query(query, [userId]);'
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="xl:col-span-5 p-4 sm:p-5 flex flex-col justify-between bg-[#0A111E]">
      <div>
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1">
          {categories.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Issue Diagnostic Box */}
        <div className="rounded-xl bg-[#0E1626] border border-white/[0.08] p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  SQL Injection Risk
                </h4>
                <p className="text-[11px] text-gray-400 font-mono">
                  File: userController.js:41
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10">
              HIGH
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-300 leading-relaxed">
            User input is directly concatenated into SQL query which can lead to SQL injection attacks.
          </p>

          {/* Recommendation Box */}
          <div className="p-3 rounded-lg bg-[#0A1220] border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Recommendation</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Use parameterized queries or prepared statements to prevent SQL injection.
            </p>

            {/* Code Fix Solution with Copy Button */}
            <div className="relative p-2.5 rounded bg-[#060B14] border border-white/5 font-mono text-[10px] sm:text-[11px] text-gray-300 space-y-0.5 overflow-x-auto">
              <button
                onClick={handleCopy}
                aria-label="Copy solution code"
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <div className="text-emerald-400">const query = "SELECT * FROM users WHERE id = ?";</div>
              <div className="text-cyan-300">const result = await db.query(query, [userId]);</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 mt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
        <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer">
          View in Code
        </button>

        <button
          onClick={() => setIsResolved(!isResolved)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isResolved
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10'
          }`}
        >
          {isResolved ? '✓ Resolved' : 'Mark as Resolved'}
        </button>
      </div>
    </div>
  );
};
