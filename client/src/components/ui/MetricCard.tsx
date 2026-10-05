import React from 'react';
import { Card } from './Card';
import { cn } from '../../utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface MetricCardProps {
  value: string;
  label: string;
  icon?: React.ReactNode;
  compact?: boolean;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  icon,
  compact = false,
  change,
  trend = 'up',
  className,
}) => {
  if (compact) {
    return (
      <div className={cn('space-y-1 text-left select-none', className)}>
        {icon && <div className="shrink-0 mb-1">{icon}</div>}
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {value}
        </div>
        <div className="text-xs text-gray-400 font-medium leading-snug">
          {label}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('p-5 sm:p-6 transition-all duration-300 hover:border-white/15', className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {value}
          </div>
          <div className="text-sm font-medium text-gray-400 mt-1">
            {label}
          </div>
          {change && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-semibold mt-2',
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-gray-400'
            )}>
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
