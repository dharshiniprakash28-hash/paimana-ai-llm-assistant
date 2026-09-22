import { useState } from 'react';
import { Shield, Bell, Search, LogOut, User, Compass } from 'lucide-react';
import DataSourceSelector from './DataSourceSelector';

export default function Navbar({ user, onLogout, onSearch, alertCount = 0, onOpenAlerts, onOpenDemoTour }) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchInput);
    }
  };

  return (
    <header className="app-navbar sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 md:px-6 py-3 flex items-center justify-between gap-4 shadow-[0_4px_25px_rgba(0,0,0,0.45)]">
      {/* Brand */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white border border-white/10 ring-1 ring-white/10">
          <Shield className="w-5 h-5 drop-shadow" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1">
              PAIMANA<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 font-black">-AI</span>
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm">
              SIH26103
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden md:block">
            Predictive Infrastructure Monitoring & Early Warning System
          </p>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-md hidden sm:block">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, ID (e.g. PRJ-101), or ministry..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/90 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
          />
        </form>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Active data source switch */}
        <DataSourceSelector />

        {/* Guided Demo Tour Trigger */}
        <button
          onClick={onOpenDemoTour}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-950/80 to-blue-950/80 hover:from-indigo-900 hover:to-blue-900 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:shadow-indigo-500/20"
          title="Interactive demonstration story"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Demo Tour Guide</span>
        </button>

        {/* Alerts Notification Button */}
        <button
          onClick={onOpenAlerts}
          className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all shadow-sm"
          title="View Early Warning Alerts"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse">
              {alertCount}
            </span>
          )}
        </button>

        {/* User profile pill */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center text-indigo-400 shadow-sm">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-white leading-tight">
              {user?.name || 'Monitoring Officer'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Role: {user?.role || 'Admin'}
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
