import React from 'react';
import { Card } from './Card';
import { cn } from '../../utils/cn';
import { Shield, Lock, LineChart, MessageSquare, Code, Sparkles } from 'lucide-react';

export interface FeatureCardProps {
  title: string;
  description: string;
  iconName: string;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  iconName,
  className,
}) => {
  const renderIcon = () => {
    switch (iconName) {
      case 'Shield':
        return <Shield className="w-5 h-5 text-indigo-400" />;
      case 'Lock':
        return <Lock className="w-5 h-5 text-emerald-400" />;
      case 'LineChart':
        return <LineChart className="w-5 h-5 text-cyan-400" />;
      case 'MessageSquare':
        return <MessageSquare className="w-5 h-5 text-purple-400" />;
      case 'Code':
        return <Code className="w-5 h-5 text-indigo-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <Card
      glow
      hoverEffect
      className={cn('p-6 sm:p-7 flex flex-col justify-between group', className)}
    >
      <div>
        <div className="w-11 h-11 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:bg-white/10 group-hover:scale-105 transition-all duration-300">
          {renderIcon()}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2.5 group-hover:text-indigo-300 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
};
