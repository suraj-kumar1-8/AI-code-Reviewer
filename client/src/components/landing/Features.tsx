import React from 'react';
import { Container } from '../ui/Container';
import { ChevronRight, Shield, BarChart3, MessageSquare } from 'lucide-react';

export const Features: React.FC = () => {
  const features = [
    {
      id: 'deep-analysis',
      title: 'Deep Code Analysis',
      description: 'AI understands your code and finds real issues.',
      icon: (
        <span className="font-mono text-sm font-bold text-indigo-400">&lt;/&gt;</span>
      ),
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      id: 'security-detection',
      title: 'Security Detection',
      description: 'Identify vulnerabilities and security risks before they reach production.',
      icon: <Shield className="w-5 h-5 text-cyan-400" />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      id: 'performance-insights',
      title: 'Performance Insights',
      description: 'Find bottlenecks and optimization opportunities.',
      icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      id: 'ask-codebase',
      title: 'Ask Your Codebase',
      description: 'Chat with your repository using AI-powered code understanding.',
      icon: <MessageSquare className="w-5 h-5 text-blue-400" />,
      iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 relative">
      <Container size="lg">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 mb-4 uppercase tracking-wider">
            FEATURES
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-3">
            Everything you need to write better code
          </h2>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto">
            AI-powered insights that help developers ship secure, maintainable and high-quality software.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-[#0C1322] border border-white/[0.08] hover:border-white/20 hover:bg-[#10182A] hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-950/20 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${item.iconBg}`}>
                    {item.icon}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </div>

                <h3 className="text-base font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
