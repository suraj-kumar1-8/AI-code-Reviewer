import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Security } from '../components/landing/Security';
import { CTA } from '../components/landing/CTA';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};
export default Landing;
