import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'security' | 'danger' | 'warning' | 'cyan' | 'success' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  dot = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    primary: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25',
    security: 'bg-red-500/10 text-red-400 border border-red-500/25',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/25',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
    cyan: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25',
    success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25',
    neutral: 'bg-gray-800/60 text-gray-300 border border-white/10',
  };

  const dotColors = {
    primary: 'bg-indigo-400',
    security: 'bg-red-400',
    danger: 'bg-red-400',
    warning: 'bg-amber-400',
    cyan: 'bg-cyan-400',
    success: 'bg-emerald-400',
    neutral: 'bg-gray-400',
  };

  return (
    <span className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
