import React from 'react';
import { Film, Search, LogOut, Smartphone, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<Props> = ({ searchQuery, onSearchChange }) => {
  const { accessCode, maxDevices, logoutViewer, settings } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#09090c]/85 border-b border-white/10 transition-colors">
      {/* Announcement Banner if configured by Admin */}
      {settings.announcementEnabled && settings.announcementText && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-semibold text-amber-200 flex items-center justify-center gap-2">
          <span>📢 {settings.announcementText}</span>
          {settings.announcementLink && (
            <a
              href={settings.announcementLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline text-amber-300 hover:text-white text-[11px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
            >
              زيارة الرابط
            </a>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.siteName}
              className="h-9 max-w-[140px] object-contain rounded-lg"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Film className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-wider uppercase text-white font-mono leading-none">
              {settings.siteName || 'viE'}
            </span>
            <span className="text-[10px] text-white/50 tracking-wider">
              {settings.siteDescription || 'STREAM PLATFORM'}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-2 sm:mx-6">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن مسلسل أو حلقة..."
              className="w-full bg-white/[0.05] border border-white/10 focus:border-amber-500/50 focus:bg-white/[0.08] rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/40 outline-none transition-all"
            />
          </div>
        </div>

        {/* Right User Bar */}
        <div className="flex items-center gap-3">
          {/* Access Code badge */}
          {accessCode && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{accessCode}</span>
              {maxDevices && (
                <span className="text-[10px] text-amber-400/60 ml-1 flex items-center gap-0.5">
                  <Smartphone className="w-3 h-3" /> max {maxDevices}
                </span>
              )}
            </div>
          )}

          {/* Viewer Logout */}
          <button
            onClick={logoutViewer}
            className="p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
