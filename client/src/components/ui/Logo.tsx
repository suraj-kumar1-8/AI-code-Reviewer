import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export interface LogoProps {
  iconOnly?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  asLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  iconOnly = false,
  className,
  size = 'md',
  asLink = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-xl',
  };

  const content = (
    <div className={cn('inline-flex items-center gap-2.5 select-none group', className)}>
      {/* Icon: {</>} style with subtle glow */}
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-[#0F172A] border border-indigo-500/30 text-indigo-400 font-mono font-bold shadow-md shadow-indigo-950/40 group-hover:border-indigo-400/60 transition-colors',
          iconSizes[size]
        )}
      >
        <span className="text-cyan-400 font-bold">{'{'}</span>
        <span className="text-indigo-400 text-[10px]">&lt;/&gt;</span>
        <span className="text-purple-400 font-bold">{'}'}</span>
      </div>

      {!iconOnly && (
        <span className={cn('font-bold tracking-tight text-white flex items-center', textSizes[size])}>
          <span>AI Code</span>
          <span className="ml-1 text-[#38BDF8]">Reviewer</span>
        </span>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link to="/" className="inline-flex items-center focus:outline-none" aria-label="AI Code Reviewer Home">
        {content}
      </Link>
    );
  }

  return content;
};
