import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        onLogin({
          name: 'Chief Monitoring Officer',
          role: 'Administrator / PMG Lead',
          username: 'admin',
        });
      } else {
        setError('Invalid credentials. Please use demo credentials: admin / admin123');
        setLoading(false);
      }
    }, 400);
  };

  const handleQuickDemo = () => {
    setUsername('admin');
    setPassword('admin123');
    onLogin({
      name: 'Chief Monitoring Officer',
      role: 'Administrator / PMG Lead',
      username: 'admin',
    });
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Dynamic ambient backdrop glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/15 via-blue-500/10 to-cyan-400/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <header className="p-6 border-b border-slate-800/60 flex items-center justify-between relative z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              PAIMANA<span className="text-gradient font-black">-AI</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Predictive Infrastructure Monitoring & Early Warning System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 shadow-sm">
            SIH 2026 • SIH26103
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl border border-slate-700/60 relative overflow-hidden glow-indigo">
          {/* Subtle top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />
          
          <div className="text-center mb-6 pt-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Executive Sign In</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              Integrated monitoring access for central infrastructure projects
            </p>
          </div>

          {/* Demo credentials hint box */}
          <div className="mb-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 shadow-inner">
            <div className="font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              Demo Access Credentials:
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-950/70 p-2.5 rounded-xl border border-indigo-900/50">
              <div><span className="text-slate-400">User:</span> <strong className="text-indigo-200">admin</strong></div>
              <div><span className="text-slate-400">Pass:</span> <strong className="text-indigo-200">admin123</strong></div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username / PMG ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-500"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold text-sm text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50 hover:scale-[1.01]"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
            <button
              onClick={handleQuickDemo}
              className="text-xs text-indigo-400 hover:text-cyan-300 underline font-semibold transition-colors cursor-pointer"
            >
              Instant Demo Login (Bypass manual entry)
            </button>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="p-4 border-t border-slate-800/60 text-center text-xs text-slate-400 relative z-10 backdrop-blur-md">
        SIH 2026 Prototype • Dedicated to Problem Statement SIH26103 • Synthetic Infrastructure Monitoring
      </footer>
    </div>
  );
}
