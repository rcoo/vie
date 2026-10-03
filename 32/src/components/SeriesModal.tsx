import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Film } from 'lucide-react';
import type { Series, Season, Episode } from '../types.ts';
import { apiFetch } from '../lib/api.ts';

interface Props {
  series: Series;
  onClose: () => void;
  onPlayEpisode: (episodeId: string) => void;
}

export const SeriesModal: React.FC<Props> = ({ series, onClose, onPlayEpisode }) => {
  const [detailedSeries, setDetailedSeries] = useState<Series | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch detailed series with seasons & episodes
    apiFetch(`/api/series/${series.slug}`)
      .then((res) => res.json())
      .then((data: Series) => {
        setDetailedSeries(data);
        if (data.seasons && data.seasons.length > 0) {
          setSelectedSeasonId(data.seasons[0].id);
        }
      })
      .catch((err) => console.error('Error fetching series details:', err))
      .finally(() => setLoading(false));
  }, [series.slug]);

  // Format seconds to minutes
  const formatDuration = (secs: number) => {
    if (!secs) return '';
    const mins = Math.round(secs / 60);
    return `${mins} دقيقة`;
  };

  const currentSeason = detailedSeries?.seasons?.find((s) => s.id === selectedSeasonId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#101014] border border-white/15 rounded-3xl overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Header in Modal */}
        <div className="relative h-64 sm:h-72 w-full flex-shrink-0 bg-black">
          <img
            src={series.backdrop || series.poster}
            alt={series.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101014] via-transparent to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md mb-2">
                {series.title}
              </h2>
              <p className="text-xs sm:text-sm text-white/70 line-clamp-2 leading-relaxed">
                {series.description}
              </p>
            </div>

            {currentSeason?.episodes && currentSeason.episodes.length > 0 && (
              <button
                onClick={() => onPlayEpisode(currentSeason.episodes![0].id)}
                className="hidden sm:flex px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm items-center gap-2 transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex-shrink-0"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>مشاهدة الحلقة الأولى</span>
              </button>
            )}
          </div>
        </div>

        {/* Seasons Navigation Tabs */}
        {detailedSeries?.seasons && detailedSeries.seasons.length > 0 && (
          <div className="px-6 pt-4 pb-2 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {detailedSeries.seasons.map((season) => (
              <button
                key={season.id}
                onClick={() => setSelectedSeasonId(season.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSeasonId === season.id
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                الموسم {season.seasonNumber}
              </button>
            ))}
          </div>
        )}

        {/* Episodes Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-white/40">جارٍ تحميل الحلقات...</div>
          ) : currentSeason?.episodes && currentSeason.episodes.length > 0 ? (
            currentSeason.episodes.map((ep: Episode) => (
              <div
                key={ep.id}
                onClick={() => onPlayEpisode(ep.id)}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  {/* Episode Thumbnail */}
                  <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black/60 flex-shrink-0">
                    <img
                      src={ep.thumbnail || series.backdrop || series.poster}
                      alt={ep.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        حلقة {ep.episodeNumber}
                      </span>
                      {ep.duration > 0 && (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {formatDuration(ep.duration)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {ep.title}
                    </h4>
                    <p className="text-xs text-white/50 line-clamp-2 mt-0.5 leading-relaxed">
                      {ep.description}
                    </p>
                  </div>
                </div>

                <button className="hidden sm:flex px-4 py-2 rounded-xl bg-white/5 group-hover:bg-amber-500 text-white/80 group-hover:text-black text-xs font-semibold items-center gap-1.5 transition-all flex-shrink-0">
                  <Play className="w-3 h-3 fill-current" />
                  <span>تشغيل</span>
                </button>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-white/40 flex flex-col items-center">
              <Film className="w-10 h-10 mb-2 opacity-30" />
              <span>لا توجد حلقات منشورة في هذا الموسم بعد.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
