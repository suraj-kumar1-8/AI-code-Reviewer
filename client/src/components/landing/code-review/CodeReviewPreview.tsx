import React from 'react';
import { GitBranch, ChevronDown, Sparkles, MoreHorizontal } from 'lucide-react';
import { GithubIcon } from '../../ui/GithubIcon';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { IssuePanel } from './IssuePanel';

export const CodeReviewPreview: React.FC = () => {
  return (
    <div className="w-full rounded-2xl bg-[#09101D] border-2 border-cyan-400/85 shadow-[0_0_40px_rgba(6,182,212,0.45),0_0_80px_rgba(99,102,241,0.25)] overflow-hidden text-left transition-all duration-300">
      {/* 1. Top Window Bar: GitHub Repo & Actions */}
      <div className="p-3.5 sm:p-4 border-b border-white/[0.08] bg-[#070D18] flex flex-wrap items-center justify-between gap-3">
        {/* Repo Name */}
        <div className="flex items-center gap-2.5">
          <GithubIcon className="w-5 h-5 text-white" />
          <span className="font-semibold text-sm sm:text-base text-white">facebook/react</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-gray-400">
            Public
          </span>
        </div>

        {/* Branch & Review Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131D2F] border border-white/10 text-xs text-gray-300 font-mono">
            <GitBranch className="w-3.5 h-3.5 text-gray-400" />
            <span>main</span>
            <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer active:scale-95">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>Review</span>
          </button>
        </div>
      </div>

      {/* 2. GitHub Sub-Navigation Tabs */}
      <div className="px-4 border-b border-white/[0.08] bg-[#070D18] flex items-center justify-between text-xs text-gray-400 font-medium overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-6">
          <button className="py-2.5 hover:text-white flex items-center gap-1.5 cursor-pointer">
            <span>&lt;&gt;</span>
            <span>Code</span>
          </button>

          <button className="py-2.5 hover:text-white flex items-center gap-1.5 cursor-pointer">
            <span className="w-3.5 h-3.5 rounded-full border border-gray-500 flex items-center justify-center text-[9px]">!</span>
            <span>Issues</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-gray-300">12</span>
          </button>

          <button className="py-2.5 hover:text-white flex items-center gap-1.5 cursor-pointer">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Pull requests</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-gray-300">5</span>
          </button>

          <button className="py-2.5 text-purple-300 font-semibold border-b-2 border-purple-500 flex items-center gap-1.5 cursor-pointer bg-purple-950/20 px-2 -mb-[1px]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Review</span>
          </button>

          <button className="py-2.5 hover:text-white cursor-pointer">
            Insights
          </button>
        </div>

        <button aria-label="More options" className="text-gray-500 hover:text-gray-300 p-1">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Main Split Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[380px]">
        {/* Left Sub-Panel: File Tree + Code Editor (7 cols) */}
        <div className="xl:col-span-7 flex flex-col sm:flex-row border-b xl:border-b-0 xl:border-r border-white/[0.08] bg-[#080E1A]">
          <FileTree selectedFile="userController.js" />
          <CodeEditor fileName="userController.js" />
        </div>

        {/* Right Sub-Panel: Issue Panel (5 cols) */}
        <IssuePanel />
      </div>
    </div>
  );
};
export default CodeReviewPreview;
