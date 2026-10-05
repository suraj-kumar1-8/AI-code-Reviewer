import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = false,
  hoverEffect = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-[#111827] rounded-xl border border-white/8 transition-all duration-300',
        hoverEffect && 'hover:border-white/20 hover:bg-[#151f32] hover:-translate-y-0.5',
        glow && 'hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)] hover:border-indigo-500/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
