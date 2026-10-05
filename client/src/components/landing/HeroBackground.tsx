import React from 'react';

export const HeroBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none -z-10">
      {/* 1. Deep Midnight Base */}
      <div className="absolute inset-0 bg-[#040812]" />

      {/* 2. Cyber Perspective Grid on the left */}
      <div
        className="absolute -top-10 -left-20 w-[600px] h-[500px] opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #00f0ff 1px, transparent 1px),
            linear-gradient(to bottom, #00f0ff 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse at 40% 40%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 40% 40%, black 20%, transparent 75%)',
        }}
      />

      {/* 3. Sweeping Luminous Waves (SVG Beams) */}
      <svg
        className="absolute inset-0 w-full h-full preserve-3d"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        fill="none"
      >
        <defs>
          {/* Cyan Glow Gradient */}
          <linearGradient id="cyanWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>

          {/* Purple / Magenta Laser Ribbon */}
          <linearGradient id="purpleLaserGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#e879f9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
          </linearGradient>

          {/* Right Blue/Cyan Cosmic Wave */}
          <linearGradient id="rightCosmicGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#050914" stopOpacity="0" />
          </linearGradient>

          {/* Filter for glowing laser trail */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Arced Sweeping Cyan Particle Wave across center */}
        <path
          d="M -100 650 C 250 500, 450 350, 680 180 C 850 50, 1100 20, 1500 120"
          stroke="url(#cyanWaveGrad)"
          strokeWidth="2.5"
          filter="url(#neonGlow)"
          opacity="0.65"
        />

        {/* Faint particle dot wave */}
        <path
          d="M -50 670 C 300 520, 500 370, 720 200 C 890 70, 1150 40, 1550 140"
          stroke="#00f0ff"
          strokeWidth="1.5"
          strokeDasharray="3 14"
          opacity="0.45"
        />

        {/* Purple / Magenta Laser Arc swooping down behind card */}
        <path
          d="M 600 260 C 800 140, 1050 80, 1350 200 C 1450 240, 1500 350, 1500 450"
          stroke="url(#purpleLaserGrad)"
          strokeWidth="3.5"
          filter="url(#neonGlow)"
          opacity="0.75"
        />

        {/* Secondary Purple Filament */}
        <path
          d="M 680 290 C 880 170, 1120 110, 1400 230"
          stroke="#e879f9"
          strokeWidth="1.5"
          opacity="0.5"
        />

        {/* Right Swooping Cosmic Wave */}
        <path
          d="M 1150 700 C 1300 550, 1420 380, 1480 100"
          stroke="url(#rightCosmicGrad)"
          strokeWidth="4"
          filter="url(#neonGlow)"
          opacity="0.6"
        />
      </svg>

      {/* 4. Large Ambient Blurred Color Halos */}
      {/* Indigo glow behind left */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px]" />

      {/* Electric cyan glow behind code preview card */}
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[500px] bg-cyan-500/15 rounded-full blur-[130px]" />

      {/* Vivid purple/magenta flare behind top-right */}
      <div className="absolute top-16 right-16 w-[450px] h-[450px] bg-purple-600/20 rounded-full blur-[120px]" />
    </div>
  );
};
