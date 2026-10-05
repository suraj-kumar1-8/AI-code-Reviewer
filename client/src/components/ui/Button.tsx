import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'primary-gradient' | 'secondary' | 'outline' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary-gradient',
  size = 'md',
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-6 py-3.5 gap-2.5',
  };

  const variantStyles = {
    'primary-gradient': 'bg-gradient-to-r from-[#6366F1] via-[#3B82F6] to-[#06B6D4] text-white hover:brightness-110 hover:-translate-y-0.5 shadow-[0_0_25px_rgba(59,130,246,0.35)] active:translate-y-0 active:scale-[0.98]',
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white hover:-translate-y-0.5 shadow-md shadow-indigo-600/30 active:translate-y-0 active:scale-[0.98]',
    secondary: 'bg-[#0E1626] hover:bg-[#152034] text-gray-200 hover:text-white border border-white/10 hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    outline: 'border border-white/15 hover:border-white/30 text-gray-200 hover:bg-white/5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    ghost: 'text-gray-400 hover:text-gray-100 hover:bg-white/5 active:scale-[0.98]',
    white: 'bg-white hover:bg-gray-100 text-gray-950 font-semibold shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  };

  return (
    <button
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled}
      {...props}
    >
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
