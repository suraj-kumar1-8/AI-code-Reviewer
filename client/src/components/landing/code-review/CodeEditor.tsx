import React from 'react';
import { X } from 'lucide-react';

interface CodeEditorProps {
  fileName: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ fileName }) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#080E1A]">
      {/* File Tab Header */}
      <div className="px-3 py-1.5 border-b border-white/[0.08] bg-[#091120] flex items-center justify-between text-xs text-gray-300 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-400 font-bold">JS</span>
          <span>{fileName}</span>
        </div>
        <button aria-label="Close file tab" className="text-gray-500 hover:text-gray-300">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Code Area */}
      <div className="p-3 sm:p-4 font-mono text-[11px] sm:text-xs leading-relaxed overflow-x-auto flex-1">
        <div className="space-y-1">
          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">36</span>
            <span className="text-blue-400">app.get</span>
            <span className="text-gray-400">(</span>
            <span className="text-emerald-300">"/user"</span>
            <span className="text-gray-400">,</span>{' '}
            <span className="text-purple-400 ml-1">async</span>{' '}
            <span className="text-gray-300 ml-1">(req, res) =&gt; &#123;</span>
          </div>

          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">37</span>
            <span className="text-purple-400 ml-3">const</span>{' '}
            <span className="text-indigo-300 ml-1">userId</span>{' '}
            <span className="text-gray-400">=</span>{' '}
            <span className="text-gray-300 ml-1">req.query.id;</span>
          </div>

          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">38</span>
            <span className="text-purple-400 ml-3">const</span>{' '}
            <span className="text-indigo-300 ml-1">query</span>{' '}
            <span className="text-gray-400">=</span>
          </div>

          {/* Highlighted Vulnerable Line 41 */}
          <div className="flex items-center bg-red-950/60 -mx-3 px-3 py-1 border-l-2 border-red-500 text-red-200">
            <span className="w-6 text-red-400 select-none font-bold">41</span>
            <div className="text-red-200 overflow-x-auto ml-3 font-semibold">
              <span className="text-red-300">"SELECT * FROM users WHERE id="</span>{' '}
              <span className="text-gray-400">+</span>{' '}
              <span className="text-amber-300">userId</span>
              <span className="text-gray-400">;</span>
            </div>
          </div>

          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">43</span>
            <span className="text-purple-400 ml-3">const</span>{' '}
            <span className="text-indigo-300 ml-1">result</span>{' '}
            <span className="text-gray-400">=</span>{' '}
            <span className="text-purple-400 ml-1">await</span>{' '}
            <span className="text-blue-300 ml-1">db.query</span>
            <span className="text-gray-400">(query);</span>
          </div>

          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">45</span>
            <span className="text-gray-300 ml-3">res.json(result);</span>
          </div>

          <div className="flex items-center text-gray-500">
            <span className="w-6 text-gray-600 select-none">46</span>
            <span className="text-gray-400">&#125;);</span>
          </div>
        </div>
      </div>
    </div>
  );
};
