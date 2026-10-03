import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AccessCodeGate } from './views/AccessCodeGate.tsx';
import { AdminLoginGate } from './views/AdminLoginGate.tsx';
import { AdminPanel } from './views/admin/AdminPanel.tsx';
import { MainCatalogView } from './views/MainCatalogView.tsx';
import { WatchView } from './views/WatchView.tsx';
import { Film } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, isLoading, isAdmin, settings } = useAuth();
  const [currentView, setCurrentView] = useState<'catalog' | 'watch' | 'admin'>('catalog');
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [activeResumePos, setActiveResumePos] = useState<number>(0);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-4 animate-pulse">
          <Film className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs font-mono tracking-widest text-white/40 uppercase">
          {settings?.siteName || 'viE'} Loading...
        </span>
      </div>
    );
  }

  // 1. Admin Portal Flow
  if (currentView === 'admin') {
    if (isAdmin) {
      return <AdminPanel onBackToViewer={() => setCurrentView('catalog')} />;
    }
    return <AdminLoginGate onBackToViewer={() => setCurrentView('catalog')} />;
  }

  // 2. Viewer Gate: If user does not have an authenticated Access Code session
  if (!isAuthenticated) {
    return <AccessCodeGate onOpenAdmin={() => setCurrentView('admin')} />;
  }

  // 3. Watch Episode Flow
  if (currentView === 'watch' && activeEpisodeId) {
    return (
      <WatchView
        episodeId={activeEpisodeId}
        initialResumePosition={activeResumePos}
        onSelectEpisode={(epId, pos) => {
          setActiveEpisodeId(epId);
          setActiveResumePos(pos || 0);
        }}
        onBackToCatalog={() => {
          setCurrentView('catalog');
          setActiveEpisodeId(null);
        }}
      />
    );
  }

  // 4. Default Catalog View
  return (
    <MainCatalogView
      onPlayEpisode={(epId, resumePos) => {
        setActiveEpisodeId(epId);
        setActiveResumePos(resumePos || 0);
        setCurrentView('watch');
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
