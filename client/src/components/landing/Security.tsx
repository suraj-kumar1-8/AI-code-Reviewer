import React from 'react';
import { Container } from '../ui/Container';
import { Lock, Shield, User } from 'lucide-react';

export const Security: React.FC = () => {
  const items = [
    {
      title: 'Secure GitHub OAuth',
      description: 'Read-only repository access',
      icon: <Lock className="w-5 h-5 text-cyan-400" />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Private Analysis',
      description: 'Your source code is never publicly exposed',
      icon: <Shield className="w-5 h-5 text-cyan-400" />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Developer Control',
      description: 'You decide which repositories to analyze',
      icon: <User className="w-5 h-5 text-cyan-400" />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
  ];

  return (
    <section id="security" className="py-16 sm:py-24 relative border-t border-white/[0.08]">
      <Container size="lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Heading & Subtitle */}
          <div className="lg:col-span-5 text-left">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 mb-4 uppercase tracking-wider">
              SECURITY FIRST
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              Your code stays yours.
            </h2>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              Built with security and privacy in mind.
            </p>
          </div>

          {/* Right Column: 3 Security Pillars in Row */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.title} className="flex flex-col items-start text-left space-y-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${item.iconBg}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
};
