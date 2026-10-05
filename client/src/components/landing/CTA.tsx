import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../ui/Container';
import { ArrowRight } from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';

export const CTA: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="py-14 sm:py-20 relative">
      <Container size="lg">
        {/* Sleek Horizontal Banner matching screenshot */}
        <div className="relative rounded-2xl bg-gradient-to-r from-[#0C1628] via-[#0E1A30] to-[#0A182E] border border-blue-500/25 p-7 sm:p-10 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[200px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

          {/* Left: Badge + Heading + Subtitle */}
          <div className="relative z-10 text-left max-w-2xl">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 mb-3 tracking-wider uppercase">
              GET STARTED TODAY
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Ready to ship better code?
            </h2>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Connect your GitHub repository and get your first AI-powered review.
            </p>
          </div>

          {/* Right: CTA Button */}
          <div className="relative z-10 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>Start Reviewing for Free</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
};
