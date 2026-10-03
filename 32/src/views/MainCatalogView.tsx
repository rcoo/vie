import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar.tsx';
import { HeroSection } from '../components/HeroSection.tsx';
import { ContinueWatching } from '../components/ContinueWatching.tsx';
import { SeriesGrid } from '../components/SeriesGrid.tsx';
import { SeriesModal } from '../components/SeriesModal.tsx';
import type { Series, ContinueWatchingItem } from '../types.ts';
import { apiFetch } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface Props {
  onPlayEpisode: (episodeId: string, resumePosition?: number) => void;
}

export const MainCatalogView: React.FC<Props> = ({ onPlayEpisode }) => {
  const { settings } = useAuth();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeriesModal, setSelectedSeriesModal] = useState<Series | null>(null);

  const fetchData = async () => {
    try {
      const [seriesRes, cwRes] = await Promise.all([
        apiFetch('/api/series'),
        apiFetch('/api/continue-watching')
      ]);

      if (seriesRes.ok) {
        const seriesData = await seriesRes.json();
        setSeriesList(seriesData);
      }

      if (cwRes.ok) {
        const cwData = await cwRes.json();
        setContinueWatching(cwData);
      }
    } catch (err) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const featuredSeries = seriesList.length > 0 ? seriesList[0] : null;

  // Filter series by search query
  const filteredSeries = seriesList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const handlePlayFeatured = async (seriesId: string) => {
    const s = seriesList.find((item) => item.id === seriesId);
    if (!s) return;
    try {
      const res = await apiFetch(`/api/series/${s.slug}`);
      const data = await res.json();
      if (data.seasons && data.seasons[0]?.episodes && data.seasons[0].episodes[0]) {
        onPlayEpisode(data.seasons[0].episodes[0].id);
      } else {
        setSelectedSeriesModal(s);
      }
    } catch {
      setSelectedSeriesModal(s);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090c] text-white flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="py-24 text-center text-white/40 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs">جارٍ تحميل مكتبة المسلسلات...</span>
          </div>
        ) : (
          <>
            {/* Show Featured Hero only when not searching */}
            {!searchQuery && featuredSeries && (
              <HeroSection
                series={featuredSeries}
                onPlay={handlePlayFeatured}
                onOpenDetails={(s) => setSelectedSeriesModal(s)}
              />
            )}

            {/* Continue Watching Section */}
            {!searchQuery && continueWatching.length > 0 && (
              <ContinueWatching
                items={continueWatching}
                onPlayEpisode={(epId, pos) => onPlayEpisode(epId, pos)}
              />
            )}

            {/* Catalog Grid */}
            <SeriesGrid
              seriesList={filteredSeries}
              title={searchQuery ? `نتائج البحث عن "${searchQuery}"` : 'المسلسلات المتاحة للمشاهدة'}
              onSelectSeries={(s) => setSelectedSeriesModal(s)}
            />
          </>
        )}
      </main>

      {/* Series Details Dialog */}
      {selectedSeriesModal && (
        <SeriesModal
          series={selectedSeriesModal}
          onClose={() => setSelectedSeriesModal(null)}
          onPlayEpisode={(epId) => {
            setSelectedSeriesModal(null);
            onPlayEpisode(epId);
          }}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#070709] py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white/80">{settings.siteName || 'viE'}</span>
            <span>•</span>
            <span>{settings.footerText || 'Encrypted High-Performance Streaming Platform'}</span>
          </div>
          {settings.communityUrl && (
            <a
              href={settings.communityUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 transition-colors font-medium flex items-center gap-1.5"
            >
              <span>المجتمع والدعم</span>
              <span className="text-[10px] font-mono opacity-70">({settings.siteDescription || '.gg/8mr'})</span>
            </a>
          )}
        </div>
      </footer>
    </div>
  );
};
