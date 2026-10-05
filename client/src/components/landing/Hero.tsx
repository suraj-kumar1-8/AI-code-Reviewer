import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { MetricCard } from '../ui/MetricCard';
import { CodeReviewPreview } from './code-review/CodeReviewPreview';
import { HeroBackground } from './HeroBackground';
import { ArrowRight, Play, Sparkles, X, Database, ShieldCheck, Star, Lock } from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';

export const Hero: React.FC = () => {
  const navigate = useNavigate();
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Exact 4 metrics with alternating purple and cyan icons from the screenshot
  const metrics = [
    {
      value: '10K+',
      label: 'Repositories Analyzed',
      icon: <Database className="w-5 h-5 text-[#C084FC]" />,
    },
    {
      value: '95%',
      label: 'Issue Detection Rate',
      icon: <ShieldCheck className="w-5 h-5 text-[#00F0FF]" />,
    },
    {
      value: '4.8/5',
      label: 'Developer Satisfaction',
      icon: <Star className="w-5 h-5 text-[#C084FC]" />,
    },
    {
      value: '100%',
      label: 'Secure & Private',
      icon: <Lock className="w-5 h-5 text-[#00F0FF]" />,
    },
  ];

  return (
    <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden">
      {/* Exact Cyber Background with perspective grid, glowing particle arc, and laser waves */}
      <HeroBackground />

      <Container size="lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* LEFT COLUMN: Exactly ~42% width on desktop */}
          <div className="lg:col-span-5 flex flex-col items-start text-left relative z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0B1528] text-[#00F0FF] border border-[#00F0FF]/30 mb-6 shadow-sm shadow-cyan-950/50">
              <span>Powered by AI</span>
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            </div>

            {/* Compact, strong headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-white leading-[1.08] mb-5">
              Your GitHub <br />
              Codebase <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-[#818CF8] to-[#00F0FF]">
                Reviewed by AI
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-md mb-8 font-normal">
              Find bugs, security issues, performance problems and get smart suggestions to improve your code.
            </p>

            {/* CTA Buttons Row: Primary dominates with gradient & glow */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto mb-12">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#6366F1] via-[#3B82F6] to-[#00F0FF] hover:brightness-110 shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                <GithubIcon className="w-4 h-4 text-white" />
                <span>Connect with GitHub</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <button
                onClick={() => setShowDemoModal(true)}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-medium text-gray-200 bg-[#0B1321] hover:bg-[#131D2F] hover:text-white border border-white/15 hover:border-white/25 transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full border border-gray-400 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 text-gray-200 fill-gray-200 ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Compact Metrics Row with Reusable MetricCard components */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/[0.08]">
              {metrics.map((item) => (
                <MetricCard
                  key={item.label}
                  value={item.value}
                  label={item.label}
                  icon={item.icon}
                  compact
                />
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Exactly ~58% width on desktop */}
          <div className="lg:col-span-7 w-full flex justify-center relative z-10">
            <CodeReviewPreview />
          </div>
        </div>
      </Container>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-[#0F172A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">AI Code Reviewer Demo Walkthrough</h3>
              <button
                onClick={() => setShowDemoModal(false)}
                aria-label="Close demo modal"
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-gray-300">
                Experience full repository analysis, AST bug detection, and automated PR review comments.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Button
                  variant="primary-gradient"
                  size="md"
                  onClick={() => {
                    setShowDemoModal(false);
                    navigate('/dashboard');
                  }}
                >
                  Explore Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowDemoModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
export default Hero;
