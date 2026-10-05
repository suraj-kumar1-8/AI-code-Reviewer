import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: string;
  upcomingHighlights?: string[];
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  title = 'Feature Coming Soon',
  description = 'This feature is part of our upcoming release roadmap.',
  feature = 'Settings & Custom Analysis',
  upcomingHighlights = [
    'Custom AI Review Rulesets & Prompt Templates',
    'Automated Pull Request Review Webhooks',
    'Multi-model selection (Claude 3.7, GPT-4o, Gemini 2.0)',
    'Team Workspace & Role-based Access Control',
  ],
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0F172A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <Badge variant="cyan" size="sm">
                  Day 3+ Roadmap
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{feature}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Description */}
        <p className="text-xs text-gray-300 leading-relaxed">{description}</p>

        {/* Highlights List */}
        {upcomingHighlights && upcomingHighlights.length > 0 && (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Planned Capabilities:
            </span>
            <ul className="space-y-2">
              {upcomingHighlights.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-mono">
            Status: Under Active Development
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModal;
