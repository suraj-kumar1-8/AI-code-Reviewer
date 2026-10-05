import React, { useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { GithubIcon } from '../components/ui/GithubIcon';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Lock,
  BarChart3,
  MessageSquare,
  EyeOff,
  Users,
  ShieldCheck,
  Star,
  Zap,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Bug,
  Code2,
  AlertTriangle,
  X
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, isAuthenticated, loading } = useAuth();

  const oauthError = searchParams.get('error');
  const oauthMessage = searchParams.get('message');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleGitHubLogin = () => {
    login();
  };

  const clearError = () => {
    searchParams.delete('error');
    searchParams.delete('message');
    setSearchParams(searchParams);
  };

  const featureItems = [
    {
      title: 'AI Code Analysis',
      description: 'Find bugs, security issues and performance problems.',
      icon: <Shield className="w-5 h-5 text-cyan-400" />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Secure & Private',
      description: 'Read-only access to your repositories.',
      icon: <Lock className="w-5 h-5 text-purple-400" />,
      iconBg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Actionable Insights',
      description: 'Get detailed recommendations to improve your code.',
      icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Ask Your Codebase',
      description: 'Chat with your repository using AI.',
      icon: <MessageSquare className="w-5 h-5 text-blue-400" />,
      iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
  ];

  const bottomMetrics = [
    {
      value: '10K+',
      label: 'Repositories Analyzed',
      icon: <Users className="w-6 h-6 text-cyan-400" />,
    },
    {
      value: '95%',
      label: 'Issue Detection Rate',
      icon: <ShieldCheck className="w-6 h-6 text-purple-400" />,
    },
    {
      value: '4.8/5',
      label: 'Developer Satisfaction',
      icon: <Star className="w-6 h-6 text-cyan-400" />,
    },
    {
      value: '100%',
      label: 'Secure & Private',
      icon: <Zap className="w-6 h-6 text-purple-400" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background radial gradients for ambient glow */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/10 via-purple-600/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-10 right-10 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* TOP HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative z-10">
        <Logo size="md" />

        <Link to="/">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#0E1626] hover:bg-[#152034] border border-white/10 hover:border-white/20 transition-all cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        </Link>
      </header>

      {/* OAUTH ERROR ALERT BANNER */}
      {oauthError && (
        <div className="max-w-2xl mx-auto w-full px-6 mb-2 relative z-20">
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start justify-between gap-3 text-left">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                  GitHub OAuth Configuration Note
                </h4>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                  {oauthMessage || 'Please configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in server/.env to enable live authorization.'}
                </p>
                <div className="mt-2 text-[11px] text-gray-400 font-mono bg-black/40 p-2 rounded border border-white/5">
                  Callback URL: http://localhost:5001/api/auth/github/callback
                </div>
              </div>
            </div>
            <button
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-4 flex items-center w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full">
          {/* LEFT COLUMN: Headings, 4 Features list + Visual Preview */}
          <div className="lg:col-span-7 flex flex-col space-y-7">
            {/* AI Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#111C30] text-cyan-400 border border-cyan-500/25 w-max">
              <span>Powered by AI</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Welcome to <br />
                <span className="gradient-text">AI Code Reviewer</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl leading-relaxed">
                Connect your GitHub account and get AI-powered code reviews, security insights, and smart suggestions to improve your code.
              </p>
            </div>

            {/* Split row: Left 4 Features + Right Code Preview Graphic */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-1">
              {/* 4 Feature Items */}
              <div className="md:col-span-5 space-y-4">
                {featureItems.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Graphic Code Review Preview Card (Glass & Floating Badges) */}
              <div className="md:col-span-7 relative">
                {/* Main Window */}
                <div className="rounded-xl bg-[#091120]/95 border border-white/10 shadow-2xl p-3.5 text-left font-mono text-[11px] space-y-2.5 backdrop-blur-md">
                  {/* Window Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[11px] text-gray-400">
                    <div className="flex items-center gap-2">
                      <GithubIcon className="w-3.5 h-3.5 text-white" />
                      <span className="font-sans font-semibold text-white">facebook/react</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10">Public</span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 border-b border-white/5 pb-1 font-sans">
                    <span>Code</span>
                    <span>Issues</span>
                    <span className="text-indigo-400 font-bold border-b border-indigo-400 pb-0.5">AI Review</span>
                    <span>Pull requests</span>
                    <span>Insights</span>
                  </div>

                  {/* Breadcrumb */}
                  <div className="text-[10px] text-gray-400">
                    src &gt; components &gt; <span className="text-amber-300 font-semibold">userController.js</span>
                  </div>

                  {/* Code snippet */}
                  <div className="space-y-0.5 text-[10px] leading-relaxed text-gray-300">
                    <div><span className="text-gray-600 mr-2">38</span>app.get("/user", async (req, res) =&gt; &#123;</div>
                    <div><span className="text-gray-600 mr-2">39</span>  const userId = req.query.id;</div>
                    <div><span className="text-gray-600 mr-2">40</span>  const query =</div>
                    <div className="bg-red-950/40 -mx-2 px-2 py-0.5 border-l-2 border-red-500 text-red-200">
                      <span className="text-red-400 mr-2 font-bold">41</span>  "SELECT * FROM users WHERE id=" + userId;
                    </div>
                    <div><span className="text-gray-600 mr-2">42</span>  const result = await db.query(query);</div>
                    <div><span className="text-gray-600 mr-2">43</span>  res.json(result);</div>
                    <div><span className="text-gray-600 mr-2">44</span>&#125;);</div>
                  </div>
                </div>

                {/* Floating Severity Badges on Right side */}
                <div className="absolute -top-3 -right-2 space-y-1.5 hidden sm:block">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0F172A]/90 border border-red-500/30 text-[10px] shadow-lg">
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    <span className="text-gray-300">Security Issues</span>
                    <span className="font-bold text-red-400 ml-1">3</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0F172A]/90 border border-blue-500/30 text-[10px] shadow-lg">
                    <Code2 className="w-3 h-3 text-cyan-400" />
                    <span className="text-gray-300">Code Quality</span>
                    <span className="font-bold text-cyan-400 ml-1">2</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0F172A]/90 border border-purple-500/30 text-[10px] shadow-lg">
                    <BarChart3 className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300">Performance</span>
                    <span className="font-bold text-purple-400 ml-1">2</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0F172A]/90 border border-amber-500/30 text-[10px] shadow-lg">
                    <Bug className="w-3 h-3 text-amber-400" />
                    <span className="text-gray-300">Potential Bugs</span>
                    <span className="font-bold text-amber-400 ml-1">1</span>
                  </div>
                </div>

                {/* Prominent Floating Security Finding Card */}
                <div className="mt-3 p-3.5 rounded-xl bg-[#0D1524]/95 border border-red-500/25 shadow-xl space-y-2 backdrop-blur-md text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center text-red-400 shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">SQL Injection Risk</h5>
                        <p className="text-[10px] text-gray-400 font-mono">File: userController.js:41</p>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-500/10">
                      HIGH
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    User input is directly concatenated into SQL query which can lead to SQL injection attacks.
                  </p>

                  <div className="flex items-start gap-2 pt-1 border-t border-white/5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 block">Recommendation</span>
                      <p className="text-[10px] text-gray-300 leading-tight">
                        Use parameterized queries or prepared statements to prevent SQL injection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: The Login Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="rounded-2xl bg-[#0C1322] border border-white/10 p-7 sm:p-8 shadow-2xl space-y-6">
              {/* Centered Brand Icon & Lockup */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#111C30] border border-indigo-500/30 text-indigo-400 font-mono text-xl shadow-lg shadow-indigo-950/40">
                  <span className="text-cyan-400 font-bold">{'{'}</span>
                  <span className="text-indigo-400 text-sm font-bold">&lt;/&gt;</span>
                  <span className="text-purple-400 font-bold">{'}'}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-white">
                  <span>AI Code </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                    Reviewer
                  </span>
                </h2>
                <p className="text-xs text-gray-400">
                  Sign in to your account
                </p>
              </div>

              {/* Continue with GitHub Button */}
              <button
                onClick={handleGitHubLogin}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#6366F1] via-[#3B82F6] to-[#06B6D4] hover:opacity-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                <GithubIcon className="w-5 h-5 text-white" />
                <span>Continue with GitHub</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              {/* OR Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#0C1322] px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  OR
                </span>
                <div className="border-t border-white/10 w-full" />
              </div>

              {/* 3 Security Pillars in Card */}
              <div className="space-y-3 text-left">
                <div className="p-3 rounded-xl bg-[#09101D] border border-white/6 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Secure GitHub OAuth
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      We use secure OAuth to connect your account.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#09101D] border border-white/6 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Read-only Repository Access
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      We can only read your repositories, never modify your code.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#09101D] border border-white/6 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Your Code Stays Private
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Your source code is never stored permanently.
                    </p>
                  </div>
                </div>
              </div>

              {/* Terms of Service & Privacy Policy Note */}
              <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-2">
                By continuing, you agree to our{' '}
                <a href="#terms" className="text-indigo-400 hover:text-indigo-300 underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-indigo-400 hover:text-indigo-300 underline">
                  Privacy Policy
                </a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* BOTTOM ROW: 4 Trust Metrics */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {bottomMetrics.map((m) => (
            <div key={m.label} className="flex items-center gap-3.5">
              <div className="shrink-0">{m.icon}</div>
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {m.value}
                </div>
                <div className="text-xs text-gray-400 font-medium">
                  {m.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};
export default Login;
