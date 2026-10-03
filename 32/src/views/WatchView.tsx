import React, { useState, useEffect } from 'react';
import { CustomVideoPlayer } from '../components/player/CustomVideoPlayer.tsx';
import { Film, Play, ArrowLeft, Clock } from 'lucide-react';
import type { Episode, Series, Season } from '../types.ts';
import { apiFetch } from '../lib/api.ts';

interface Props {
  episodeId: string;
  initialResumePosition?: number;
  onSelectEpisode: (episodeId: string, position?: number) => void;
  onBackToCatalog: () => void;
}

export const WatchView: React.FC<Props> = ({
  episodeId,
  initialResumePosition = 0,
  onSelectEpisode,
  onBackToCatalog
}) => {
  const [data, setData] = useState<{
    episode: Episode;
    season: Season;
    series: Series;
    sources: Array<{ id: string; name: string; type: string }>;
    prevEpisode: { id: string; episodeNumber: number; title: string } | null;
    nextEpisode: { id: string; episodeNumber: number; title: string } | null;
    savedPosition: number;
    allSeasonEpisodes: Array<{ id: string; episodeNumber: number; title: string; duration: number; thumbnail: string }>;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiFetch(`/api/episodes/${episodeId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'تعذر تحميل بيانات الحلقة.');
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((err: any) => {
        setError(err.message || 'حدث خطأ في تحميل الحلقة.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [episodeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090c] text-white flex flex-col items-center justify-center p-6">
        <Film className="w-12 h-12 text-amber-500 animate-pulse mb-3" />
        <span className="text-sm text-white/60">جارٍ تجهيز مشغل الفيديو...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#09090c] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 max-w-md mb-6">
          {error || 'لم يتم العثور على الحلقة'}
        </div>
        <button
          onClick={onBackToCatalog}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
        >
          الرجوع إلى الصفحة الرئيسية
        </button>
      </div>
    );
  }

  const effectiveResumePosition = initialResumePosition > 0 ? initialResumePosition : data.savedPosition;

  return (
    <div className="min-h-screen bg-[#08080a] text-white pb-20">
      {/* Top minimal header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBackToCatalog}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>الرجوع إلى الرئيسية</span>
        </button>

        <div className="text-xs text-white/50 font-mono">
          {data.series.title} • الموسم {data.season.seasonNumber}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Custom Video Player Embed */}
        <div className="w-full">
          <CustomVideoPlayer
            episodeId={data.episode.id}
            episodeTitle={data.episode.title}
            episodeNumber={data.episode.episodeNumber}
            seasonNumber={data.season.seasonNumber}
            seriesTitle={data.series.title}
            initialPosition={effectiveResumePosition}
            prevEpisode={data.prevEpisode}
            nextEpisode={data.nextEpisode}
            availableSources={data.sources}
            onSelectEpisode={(newId) => onSelectEpisode(newId)}
            onBack={onBackToCatalog}
          />
        </div>

        {/* Episode Info & Season Episodes Carousel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <span>{data.series.title}</span>
              <span>•</span>
              <span>الموسم {data.season.seasonNumber}</span>
              <span>•</span>
              <span>الحلقة {data.episode.episodeNumber}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {data.episode.title}
            </h1>

            <p className="text-sm text-white/70 leading-relaxed max-w-2xl">
              {data.episode.description || data.series.description}
            </p>
          </div>

          {/* Right Column: Other Episodes in this Season */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-xs uppercase tracking-wider text-white/60 font-bold">
                حلقات الموسم {data.season.seasonNumber}
              </h3>
              <span className="text-[11px] font-mono text-white/40">
                {data.allSeasonEpisodes.length} حلقة
              </span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto no-scrollbar">
              {data.allSeasonEpisodes.map((ep) => {
                const isCurrent = ep.id === data.episode.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => {
                      if (!isCurrent) onSelectEpisode(ep.id);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                        : 'bg-white/[0.01] hover:bg-white/[0.05] border border-transparent text-white/80'
                    }`}
                  >
                    {/* Thumbnail or Badge */}
                    <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black/60 flex-shrink-0">
                      <img
                        src={ep.thumbnail || data.series.backdrop || data.series.poster}
                        alt={ep.title}
                        className="w-full h-full object-cover"
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                          <Play className="w-4 h-4 fill-amber-300 text-amber-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono font-bold text-amber-400">
                        الحلقة {ep.episodeNumber}
                      </div>
                      <div className="text-xs font-semibold truncate text-white">
                        {ep.title}
                      </div>
                      {ep.duration > 0 && (
                        <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{Math.round(ep.duration / 60)} دقيقة</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
