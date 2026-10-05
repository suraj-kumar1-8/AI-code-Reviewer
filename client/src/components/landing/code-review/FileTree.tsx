import React from 'react';
import { Folder, FileCode, ChevronDown, ChevronRight } from 'lucide-react';

interface FileTreeProps {
  selectedFile: string;
  onSelectFile?: (file: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ selectedFile }) => {
  return (
    <div className="w-full sm:w-44 border-b sm:border-b-0 sm:border-r border-white/[0.08] p-3 text-xs font-mono shrink-0 select-none bg-[#070D18]">
      <div className="space-y-1">
        {/* src directory */}
        <div className="flex items-center gap-1.5 text-gray-300 font-medium">
          <ChevronDown className="w-3 h-3 text-gray-500" />
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>src</span>
        </div>

        <div className="pl-4 space-y-1 text-gray-400">
          <div className="flex items-center gap-1.5 hover:text-gray-200 cursor-pointer">
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <Folder className="w-3.5 h-3.5 text-gray-500" />
            <span>components</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-gray-200 cursor-pointer">
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <Folder className="w-3.5 h-3.5 text-gray-500" />
            <span>hooks</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-gray-200 cursor-pointer">
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <Folder className="w-3.5 h-3.5 text-gray-500" />
            <span>utils</span>
          </div>

          {/* Active / Highlighted File */}
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-semibold border-l-2 border-indigo-400">
            <span className="text-[10px] text-amber-400 font-bold">JS</span>
            <span className="truncate">{selectedFile}</span>
          </div>

          <div className="flex items-center gap-1.5 pl-2 text-gray-400 hover:text-gray-200 cursor-pointer">
            <FileCode className="w-3 h-3 text-gray-500" />
            <span>auth.js</span>
          </div>
          <div className="flex items-center gap-1.5 pl-2 text-gray-400 hover:text-gray-200 cursor-pointer">
            <FileCode className="w-3 h-3 text-gray-500" />
            <span>database.js</span>
          </div>
          <div className="flex items-center gap-1.5 pl-2 text-gray-400 hover:text-gray-200 cursor-pointer">
            <FileCode className="w-3 h-3 text-gray-500" />
            <span>routes.js</span>
          </div>
        </div>

        {/* Other Root Folders */}
        <div className="flex items-center gap-1.5 text-gray-400 pt-1">
          <ChevronRight className="w-3 h-3 text-gray-600" />
          <Folder className="w-3.5 h-3.5 text-gray-500" />
          <span>tests</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <ChevronRight className="w-3 h-3 text-gray-600" />
          <Folder className="w-3.5 h-3.5 text-gray-500" />
          <span>docs</span>
        </div>
        <div className="flex items-center gap-1.5 pl-4 text-gray-400">
          <FileCode className="w-3 h-3 text-gray-500" />
          <span>package.json</span>
        </div>
        <div className="flex items-center gap-1.5 pl-4 text-gray-400">
          <FileCode className="w-3 h-3 text-gray-500" />
          <span>README.md</span>
        </div>
      </div>
    </div>
  );
};
