import React from 'react';
import { Container } from '../ui/Container';
import { FileText, Sparkles, Check, ArrowRight } from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Connect GitHub',
      description: 'Link your GitHub account securely.',
      icon: <GithubIcon className="w-4 h-4 text-white" />,
      iconBg: 'bg-white/10',
    },
    {
      num: '02',
      title: 'Select Repository',
      description: 'Choose the repository you want to analyze.',
      icon: <FileText className="w-4 h-4 text-indigo-400" />,
      iconBg: 'bg-indigo-500/15',
    },
    {
      num: '03',
      title: 'AI Analyzes Code',
      description: 'Get detailed insights and suggestions.',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      iconBg: 'bg-cyan-500/15',
    },
    {
      num: '04',
      title: 'Fix & Improve',
      description: 'Improve your code with actionable recommendations.',
      icon: <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />,
      iconBg: 'bg-emerald-500/20',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 relative">
      <Container size="lg">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 mb-4 uppercase tracking-wider">
            SIMPLE PROCESS
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-3">
            How it works
          </h2>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
            Get started in minutes and improve your code quality instantly.
          </p>
        </div>

        {/* 4 Connected Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
          {steps.map((step, idx) => (
            <div key={step.num} className="relative flex items-center">
              {/* Step Card / Content */}
              <div className="w-full flex items-start gap-3.5 p-4 rounded-xl hover:bg-white/3 transition-colors">
                {/* Number Badge */}
                <span className="w-7 h-7 rounded-full bg-[#131D2F] border border-white/10 flex items-center justify-center text-xs font-mono font-bold text-gray-300 shrink-0">
                  {step.num}
                </span>

                {/* Icon Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.iconBg}`}>
                  {step.icon}
                </div>

                {/* Copy */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Arrow connector between steps on desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-3 text-gray-600 z-10">
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
